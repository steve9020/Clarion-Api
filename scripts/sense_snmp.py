#!/usr/bin/env python3
# SENSE — network target sensor. Outputs JSON.
# Usage: python3 sense_snmp.py <target> [community]
# Tries SNMP via pysnmp; falls back to basic TCP/DNS sensing if unavailable.
import sys
import json
import socket

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "target required"}))
        return

    target = sys.argv[1]
    community = sys.argv[2] if len(sys.argv) > 2 else 'public'
    result = {"target": target, "community": community, "sensed": {}}

    # Basic network sensing (always works, no dependencies)
    try:
        # DNS resolution
        try:
            ip = socket.gethostbyname(target)
            result["sensed"]["resolved_ip"] = ip
        except socket.gaierror as e:
            result["sensed"]["dns_error"] = str(e)
            ip = target

        # TCP port checks (common service ports)
        common_ports = [22, 80, 443, 161, 8080]
        open_ports = []
        for port in common_ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                if sock.connect_ex((ip, port)) == 0:
                    open_ports.append(port)
                sock.close()
            except:
                pass
        result["sensed"]["open_tcp_ports"] = open_ports

        # Try SNMP if pysnmp is available (guarded against broken imports)
        snmp_data = try_snmp(target, community)
        if snmp_data:
            result["sensed"]["snmp"] = snmp_data
            result["status"] = "sensed"
        else:
            result["status"] = "sensed_basic"
            result["sensed"]["note"] = "SNMP library unavailable; basic network sensing only"

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)}"

    print(json.dumps(result))

def try_snmp(target, community):
    """Attempt SNMP query. Returns dict or None. Never raises."""
    try:
        # Guard against recursion issues in broken pysnmp installs
        import sys
        old_limit = sys.getrecursionlimit()
        sys.setrecursionlimit(200)
        try:
            import asyncio
            from pysnmp.hlapi.v3arch.asyncio import (
                SnmpEngine, CommunityData, UdpTransportTarget,
                ContextData, ObjectType, ObjectIdentity, get_cmd
            )
        except (ImportError, RecursionError):
            return None
        finally:
            sys.setrecursionlimit(old_limit)

        oids = [
            ('SNMPv2-MIB', 'sysDescr', 0),
            ('SNMPv2-MIB', 'sysName', 0),
        ]

        async def run():
            snmp_engine = SnmpEngine()
            try:
                transport = await UdpTransportTarget.create((target, 161), timeout=3, retries=1)
                response = await get_cmd(
                    snmp_engine,
                    CommunityData(community),
                    transport,
                    ContextData(),
                    *[ObjectType(ObjectIdentity(*oid)) for oid in oids]
                )
                error_indication, error_status, error_index, var_binds = response
                if error_indication or error_status:
                    return None
                data = {}
                for oid, value in var_binds:
                    oid_str = oid.prettyPrint()
                    val_str = value.prettyPrint()
                    if 'sysDescr' in oid_str:
                        data["description"] = val_str
                    elif 'sysName' in oid_str:
                        data["name"] = val_str
                return data
            finally:
                try:
                    snmp_engine.close_dispatcher()
                except:
                    pass

        return asyncio.run(run())
    except:
        return None

if __name__ == '__main__':
    main()
