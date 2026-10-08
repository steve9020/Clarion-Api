#!/usr/bin/env ruby
# SHAPE — clarion-builder wrapper.
# Takes a JSON spec, generates structured XML. Outputs JSON with the XML.
# Usage: ruby shape_builder.rb '<json spec>'
require 'json'

begin
  require 'builder'
rescue LoadError => e
  puts JSON.generate({ "error" => "builder gem not available: #{e.message}" })
  exit 1
end

def build_xml(xml, data)
  case data
  when Hash
    data.each do |key, value|
      tag = key.to_s.gsub(/[^a-zA-Z0-9_]/, '_')
      tag = "item" if tag.empty?
      if value.is_a?(Hash) || value.is_a?(Array)
        xml.tag!(tag) { build_xml(xml, value) }
      else
        xml.tag!(tag, value.to_s)
      end
    end
  when Array
    data.each_with_index do |item, i|
      if item.is_a?(Hash) || item.is_a?(Array)
        xml.tag!("item", "index" => i.to_s) { build_xml(xml, item) }
      else
        xml.tag!("item", item.to_s, "index" => i.to_s)
      end
    end
  else
    xml.text!(data.to_s)
  end
end

spec_json = ARGV[0]
unless spec_json
  puts JSON.generate({ "error" => "spec required (JSON string)" })
  exit 1
end

begin
  spec = JSON.parse(spec_json)
rescue JSON::ParserError => e
  puts JSON.generate({ "error" => "invalid JSON spec: #{e.message}" })
  exit 1
end

begin
  xml = Builder::XmlMarkup.new(:indent => 2)
  xml.instruct!(:xml, :version => "1.0", :encoding => "UTF-8")
  xml.clarion do
    build_xml(xml, spec)
  end
  result = {
    "program" => "shape",
    "status" => "shaped",
    "xml" => xml.target!
  }
  puts JSON.generate(result)
rescue => e
  puts JSON.generate({ "error" => "shape failed: #{e.message}" })
  exit 1
end
