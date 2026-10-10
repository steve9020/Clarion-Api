#!/usr/bin/env ruby
# PROVE — clarion-given, safe edition.
#
# Given/When/Then over DATA, never code.
#
# There is no eval, no system, no require of Alice input, and no
# interpolation of Alice input into Ruby source. Alice sends JSON data;
# this script walks it against a FIXED table of safe ops. A Alice who
# sends {"op": "system", "args": ["rm -rf /"]} gets an error, not a shell.
#
# Usage: ruby prove_safe.rb '<json spec>'
# Spec: {"given": {"x": 21},
#        "when": {"op": "mul", "args": [{"var": "x"}, 2]},
#        "then": {"op": "eq", "args": [{"var": "result"}, 42]}}
#
# Expression shapes:
#   <literal>              any JSON value: 42, "hi", true, null, [1,2], {"a":1}
#   {"var": "name"}        a given value, or "result" inside `then`
#   {"op": name, "args": [...]}   one of the OPS below
#
# OPS:
#   add sub mul div mod          arithmetic (numbers)
#   eq ne gt gte lt lte          comparison
#   and or not                   logic (truthy)
#   len                          string/array/object length
#   concat                       join strings, or join arrays
#   get                          index into array / key out of object
require 'json'

MAX_NODES = 200

OPS = {
  'add'    => ->(a) { num(a[0]) + num(a[1]) },
  'sub'    => ->(a) { num(a[0]) - num(a[1]) },
  'mul'    => ->(a) { num(a[0]) * num(a[1]) },
  'div'    => ->(a) { num(a[0]) / num(a[1]) },
  'mod'    => ->(a) { num(a[0]) % num(a[1]) },
  'eq'     => ->(a) { a[0] == a[1] },
  'ne'     => ->(a) { a[0] != a[1] },
  'gt'     => ->(a) { cmp(a[0]) > cmp(a[1]) },
  'gte'    => ->(a) { cmp(a[0]) >= cmp(a[1]) },
  'lt'     => ->(a) { cmp(a[0]) < cmp(a[1]) },
  'lte'    => ->(a) { cmp(a[0]) <= cmp(a[1]) },
  'and'    => ->(a) { a.all? { |v| v } },
  'or'     => ->(a) { a.any? { |v| v } },
  'not'    => ->(a) { !a[0] },
  'len'    => ->(a) { sized(a[0]).length },
  'concat' => ->(a) { concat(a) },
  'get'    => ->(a) { get(a[0], a[1]) },
}.freeze

def num(v)
  raise TypeError, "not a number: #{v.class}" unless v.is_a?(Numeric)
  v
end

def cmp(v)
  raise TypeError, "not comparable: #{v.class}" unless v.is_a?(Numeric) || v.is_a?(String)
  v
end

def sized(v)
  raise TypeError, "no length: #{v.class}" unless v.is_a?(String) || v.is_a?(Array) || v.is_a?(Hash)
  v
end

def concat(a)
  if a.all? { |v| v.is_a?(String) }
    a.join
  elsif a.all? { |v| v.is_a?(Array) }
    a.reduce([], :+)
  else
    raise TypeError, "concat needs all strings or all arrays"
  end
end

def get(container, key)
  case container
  when Array
    raise TypeError, "array index must be an integer" unless key.is_a?(Integer)
    container[key]
  when Hash
    container[key.to_s]
  else
    raise TypeError, "get needs an array or object"
  end
end

def evaluate(node, scope, count)
  count[0] += 1
  raise "expression too large" if count[0] > MAX_NODES

  case node
  when Hash
    if node.key?('var')
      name = node['var']
      raise "var name must be a string" unless name.is_a?(String)
      raise "unknown variable: #{name}" unless scope.key?(name)
      scope[name]
    elsif node.key?('op')
      op = node['op']
      args = node['args']
      raise "op name must be a string" unless op.is_a?(String)
      raise "args must be an array" unless args.is_a?(Array)
      fn = OPS[op]
      raise "unknown op: #{op}" if fn.nil?
      fn.call(args.map { |a| evaluate(a, scope, count) })
    else
      # A plain object literal — evaluate nothing inside, it's data.
      node
    end
  when Array
    node # arrays are data, not calls
  else
    node # literals are data
  end
end

def fail_out(msg)
  # Exit 0 with structured JSON: the API maps result.error -> 502.
  # (A non-zero exit would surface as a bare 500 and lose the message.)
  puts JSON.generate({ "program" => "prove", "status" => "error", "error" => msg })
  exit 0
end

spec_json = ARGV[0]
fail_out("spec required (JSON string with given/when/then)") unless spec_json

begin
  spec = JSON.parse(spec_json)
rescue JSON::ParserError => e
  fail_out("invalid JSON spec: #{e.message}")
end
fail_out("spec must be an object") unless spec.is_a?(Hash)

given = spec["given"] || {}
when_tree = spec["when"]
then_tree = spec["then"]
fail_out("when is required") if when_tree.nil?
fail_out("then is required") if then_tree.nil?
fail_out("given must be an object") unless given.is_a?(Hash)

begin
  count = [0]
  scope = given.dup
  result = evaluate(when_tree, scope, count)
  scope["result"] = result
  verdict = evaluate(then_tree, scope, count)
  puts JSON.generate({
    "program" => "prove",
    "status" => verdict ? "proven" : "failed",
    "result" => result,
    "given" => given,
    "when" => when_tree,
    "then" => then_tree,
  })
rescue => e
  fail_out(e.message)
end
