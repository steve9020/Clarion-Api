#!/usr/bin/env ruby
# PROVE — clarion-given (rspec-given) wrapper.
# Takes a JSON spec describing a test, runs it via RSpec Given/When/Then. Outputs JSON.
# Usage: ruby prove_given.rb '<json spec>'
# Spec format: {"given": {"var": "ruby_expr"}, "when": "ruby_expr", "then": "ruby_expr"}
# Example: {"given": {"x": "21"}, "when": "x * 2", "then": "result == 42"}
require 'json'
require 'tempfile'
require 'open3'

begin
  require 'rspec'
  require 'rspec/given'
rescue LoadError => e
  puts JSON.generate({ "error" => "rspec or rspec-given not available: #{e.message}" })
  exit 1
end

spec_json = ARGV[0]
unless spec_json
  puts JSON.generate({ "error" => "spec required (JSON string with given/when/then)" })
  exit 1
end

begin
  spec = JSON.parse(spec_json)
rescue JSON::ParserError => e
  puts JSON.generate({ "error" => "invalid JSON spec: #{e.message}" })
  exit 1
end

given = spec["given"] || {}
when_expr = spec["when"] || "nil"
then_expr = spec["then"] || "true"

# Build the RSpec test file
test_code = <<~RUBY
  require 'rspec/given'

  RSpec.describe "Clarion prove" do
    #{given.map { |k, v| "Given(:#{k}) { #{v} }" }.join("\n    ")}
    When(:result) { #{when_expr} }
    Then { #{then_expr} }
  end
RUBY

begin
  Tempfile.create(['clarion_prove', '_spec.rb']) do |f|
    f.write(test_code)
    f.flush

    stdout, stderr, status = Open3.capture3("rspec", f.path, "--format", "json")

    begin
      rspec_result = JSON.parse(stdout)
      summary = rspec_result["summary"] || {}
      result = {
        "program" => "prove",
        "status" => summary["failure_count"].to_i == 0 ? "proven" : "failed",
        "examples" => summary["example_count"],
        "failures" => summary["failure_count"],
        "given" => given,
        "when" => when_expr,
        "then" => then_expr
      }
      # Include failure details if any
      if summary["failure_count"].to_i > 0 && rspec_result["examples"]
        result["failure_details"] = rspec_result["examples"].select { |e| e["status"] == "failed" }.map { |e| e["full_description"] }
      end
      puts JSON.generate(result)
    rescue JSON::ParserError
      # RSpec didn't output JSON (maybe it crashed)
      puts JSON.generate({
        "program" => "prove",
        "status" => "error",
        "error" => "rspec output unparseable",
        "stdout" => stdout[0..500],
        "stderr" => stderr[0..500]
      })
    end
  end
rescue => e
  puts JSON.generate({ "error" => "prove failed: #{e.message}" })
  exit 1
end
