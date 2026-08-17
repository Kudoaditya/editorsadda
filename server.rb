#!/usr/bin/env ruby
require 'webrick'
require 'json'
require 'net/http'
require 'uri'
require 'cgi'

PORT = (ENV['PORT'] || 3000).to_i
ROOT = File.expand_path(File.dirname(__FILE__))
TRACKS_FILE = File.join(ROOT, 'tracks.json')
DEFAULT_PLAYLIST_ID = 'PLYXILd9treh0'
PLAYLIST_URL = "https://www.youtube.com/playlist?list=#{DEFAULT_PLAYLIST_ID}"

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

def sync_youtube_playlist(url = PLAYLIST_URL)
  html = fetch_url_with_redirects(url)
  return false unless html

  video_ids = html.scan(/"videoId":"([a-zA-Z0-9_-]{11})"/).flatten.uniq
  return false if video_ids.empty?

  # Check current tracks to avoid unnecessary oembed queries if unchanged
  current_tracks = []
  if File.exist?(TRACKS_FILE)
    begin
      current_tracks = JSON.parse(File.read(TRACKS_FILE))
    rescue
      current_tracks = []
    end
  end

  current_ids = current_tracks.map { |t| t['id'] }
  if current_ids == video_ids && !current_tracks.empty?
    return current_tracks # No changes
  end

  puts "🔄 Auto-Sync: Detected changes in playlist! (#{video_ids.length} tracks found)"
  tracks = []
  video_ids.each do |vid|
    existing = current_tracks.find { |t| t['id'] == vid }
    if existing
      tracks << existing
    else
      tracks << fetch_oembed(vid)
    end
  end

  File.write(TRACKS_FILE, JSON.pretty_generate(tracks))
  puts "✅ Playlist synced successfully with #{tracks.length} tracks."
  tracks
end

# Background auto-sync thread (every 60 seconds)
Thread.new do
  loop do
    sleep 60
    begin
      sync_youtube_playlist
    rescue => e
      puts "Sync error in background: #{e.message}"
    end
  end
end

server = WEBrick::HTTPServer.new(
  Port: PORT,
  DocumentRoot: ROOT,
  AccessLog: [],
  Logger: WEBrick::Log.new(nil, WEBrick::Log::WARN)
)

# API: Live Presence
server.mount_proc '/api/presence' do |req, res|
  res['Content-Type'] = 'application/json'
  res['Access-Control-Allow-Origin'] = '*'
  res.body = { count: 18 + rand(-2..4) }.to_json
end

# API: Live Tracklist / Instant Sync
server.mount_proc '/api/tracks' do |req, res|
  res['Content-Type'] = 'application/json'
  res['Access-Control-Allow-Origin'] = '*'
  res['Cache-Control'] = 'no-cache'
  
  # Trigger immediate re-sync if requested or read tracks.json
  tracks = sync_youtube_playlist || []
  if tracks.empty? && File.exist?(TRACKS_FILE)
    tracks = JSON.parse(File.read(TRACKS_FILE))
  end
  res.body = tracks.to_json
end

# API: Manual Sync Trigger
server.mount_proc '/api/sync' do |req, res|
  res['Content-Type'] = 'application/json'
  res['Access-Control-Allow-Origin'] = '*'
  tracks = sync_youtube_playlist || []
  res.body = { success: true, count: tracks.length, tracks: tracks }.to_json
end

# Static file serving
server.mount_proc '/' do |req, res|
  path = req.path == '/' ? '/index.html' : req.path
  file_path = File.join(ROOT, path)

  if File.file?(file_path)
    res['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    res['Pragma'] = 'no-cache'
    res['Expires'] = '0'
    
    ext = File.extname(file_path).downcase
    mime = WEBrick::HTTPUtils.mime_type(ext, WEBrick::HTTPUtils::DefaultMimeTypes)
    mime = 'application/javascript' if ext == '.js'
    mime = 'application/json' if ext == '.json'
    mime = 'text/css' if ext == '.css'
    mime = 'image/svg+xml' if ext == '.svg'
    res['Content-Type'] = mime
    
    res.body = File.binread(file_path)
  else
    res.status = 404
    res.body = '404 Not Found'
  end
end

trap('INT') { server.shutdown }

puts "\n🎧 EditorsAdda server is running!"
puts "👉 Local: http://localhost:#{PORT}"
puts "🔗 Auto-syncing YouTube Playlist: #{PLAYLIST_URL}\n\n"

server.start
