#!/usr/bin/env ruby
# EditorsAdda — YouTube Playlist & Video Importer
# Usage:
#   ruby scripts/import_playlist.rb "https://youtube.com/playlist?list=PLYXILd9treh0"

require 'json'
require 'net/http'
require 'uri'
require 'cgi'

TRACKS_FILE = File.expand_path(File.join(__dir__, '..', 'tracks.json'))
input = ARGV[0] || 'https://youtube.com/playlist?list=PLYXILd9treh0'

def fetch_url_with_redirects(url_str, limit = 5)
  return nil if limit == 0
  uri = URI(url_str)
  req = Net::HTTP::Get.new(uri)
  req['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: (uri.scheme == 'https')) do |http|
    http.read_timeout = 15
    http.request(req)
  end

  case res
  when Net::HTTPSuccess then res.body
  when Net::HTTPRedirection
    location = res['location']
    location = "#{uri.scheme}://#{uri.host}#{location}" if location.start_with?('/')
    fetch_url_with_redirects(location, limit - 1)
  else
    nil
  end
rescue => e
  puts "⚠️ Network error: #{e.message}"
  nil
end

def clean_title(raw)
  return ["Unknown Track", "EditorsAdda"] if raw.nil? || raw.empty?
  
  title = raw
    .gsub(/\s*\(Official (Music )?(Video|Audio|Track)\)/i, '')
    .gsub(/\s*\[Official (Music )?(Video|Audio|Track)\]/i, '')
    .gsub(/\s*\[HD\]|\s*\(HD\)/i, '')
    .gsub(/\s*\|.*$/, '')
    .strip

  artist = "EditorsAdda"
  if title.include?(' - ')
    parts = title.split(' - ', 2)
    artist = parts[0].strip
    title = parts[1].strip
  end

  [title, artist]
end

def fetch_oembed(video_id)
  body = fetch_url_with_redirects("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=#{video_id}&format=json")
  if body
    data = JSON.parse(body)
    raw = data['title'] || ''
    title, artist = clean_title(raw)
    {
      "id" => video_id,
      "title" => title.empty? ? raw : title,
      "artist" => data['author_name'] || artist,
      "album" => "EditorsAdda Playlist",
      "duration" => 240,
      "cover" => "https://i.ytimg.com/vi/#{video_id}/hqdefault.jpg",
      "rawTitle" => raw
    }
  else
    raise "Failed oembed"
  end
rescue
  {
    "id" => video_id,
    "title" => "Track #{video_id}",
    "artist" => "EditorsAdda",
    "album" => "EditorsAdda Session",
    "duration" => 240,
    "cover" => "https://i.ytimg.com/vi/#{video_id}/hqdefault.jpg",
    "rawTitle" => "YouTube Track #{video_id}"
  }
end

def extract_playlist_ids(playlist_url)
  puts "🔍 Fetching playlist from #{playlist_url}..."
  html = fetch_url_with_redirects(playlist_url)
  if html
    matches = html.scan(/"videoId":"([a-zA-Z0-9_-]{11})"/).flatten.uniq
    matches
  else
    []
  end
end

video_ids = []
if input.include?('list=') || input.include?('playlist')
  video_ids = extract_playlist_ids(input)
elsif input.include?(',')
  video_ids = input.split(',').map(&:strip).reject(&:empty?)
elsif input.include?('watch?v=')
  uri = URI(input)
  params = CGI.parse(uri.query || '')
  v = params['v']&.first
  video_ids = [v] if v
else
  video_ids = [input.strip]
end

if video_ids.empty?
  puts "❌ No video IDs found in playlist #{input}"
  exit 1
end

puts "✨ Found #{video_ids.length} tracks. Fetching metadata..."
tracks = []
video_ids.each_with_index do |vid, idx|
  print "  [#{idx + 1}/#{video_ids.length}] Fetching #{vid}... "
  track = fetch_oembed(vid)
  tracks << track
  puts "✅ \"#{track['title']}\" - #{track['artist']}"
end

File.write(TRACKS_FILE, JSON.pretty_generate(tracks))
puts "\n🎉 Successfully saved #{tracks.length} tracks into tracks.json!"
