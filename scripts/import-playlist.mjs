#!/usr/bin/env node

/**
 * EditorsAdda YouTube Playlist Importer
 * Usage:
 *   node scripts/import-playlist.mjs "https://www.youtube.com/playlist?list=PLxxxxxx"
 *   node scripts/import-playlist.mjs "videoID1,videoID2,videoID3"
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tracksFilePath = path.resolve(__dirname, '../tracks.json');

const inputUrlOrList = process.argv[2];

if (!inputUrlOrList) {
  console.log(`
🎧 EditorsAdda Playlist Importer
------------------------------------
Usage:
  node scripts/import-playlist.mjs "<YouTube Playlist URL or Video IDs>"

Examples:
  node scripts/import-playlist.mjs "https://www.youtube.com/playlist?list=PLrAlX1Lz7vI_..."
  node scripts/import-playlist.mjs "dQw4w9WgXcQ,3NWMK2MRqIk,9b0iydtDZLU"
`);
  process.exit(0);
}

function cleanTitle(raw) {
  if (!raw) return { title: 'Unknown Track', artist: 'EditorsAdda' };
  let title = raw
    .replace(/\s*\(Official Video\)/gi, '')
    .replace(/\s*\(Official Audio\)/gi, '')
    .replace(/\s*\(Official Music Video\)/gi, '')
    .replace(/\s*\[Official Video\]/gi, '')
    .replace(/\s*\[Official Audio\]/gi, '')
    .replace(/\s*\[HD\]/gi, '')
    .replace(/\s*\(HD\)/gi, '')
    .replace(/\s*\|.*$/g, '')
    .trim();

  let artist = 'EditorsAdda';
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  return { title, artist };
}

async function fetchOEmbed(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const { title, artist } = cleanTitle(data.title || '');
    return {
      id: videoId,
      title: title || data.title,
      artist: data.author_name || artist,
      album: 'EditorsAdda Session',
      duration: 240,
      cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      rawTitle: data.title
    };
  } catch (err) {
    return {
      id: videoId,
      title: `Track ${videoId}`,
      artist: 'EditorsAdda',
      album: 'EditorsAdda Session',
      duration: 240,
      cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      rawTitle: `YouTube Track ${videoId}`
    };
  }
}

async function extractPlaylistVideoIds(playlistUrl) {
  console.log(`🔍 Fetching playlist page from ${playlistUrl}...`);
  try {
    const res = await fetch(playlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
    const uniqueIds = [...new Set(matches.map(m => m[1]))];
    return uniqueIds;
  } catch (err) {
    console.error('⚠️ Could not scrape playlist directly:', err.message);
    return [];
  }
}

async function main() {
  let videoIds = [];

  if (inputUrlOrList.includes('list=') || inputUrlOrList.includes('youtube.com/playlist')) {
    videoIds = await extractPlaylistVideoIds(inputUrlOrList);
  } else if (inputUrlOrList.includes(',')) {
    videoIds = inputUrlOrList.split(',').map(s => s.trim()).filter(Boolean);
  } else if (inputUrlOrList.includes('watch?v=')) {
    const id = new URL(inputUrlOrList).searchParams.get('v');
    if (id) videoIds = [id];
  } else {
    videoIds = [inputUrlOrList.trim()];
  }

  if (!videoIds.length) {
    console.error('❌ No video IDs found. Please check your playlist link.');
    process.exit(1);
  }

  console.log(`✨ Found ${videoIds.length} tracks. Fetching metadata...`);
  const tracks = [];
  for (let i = 0; i < videoIds.length; i++) {
    const id = videoIds[i];
    process.stdout.write(`  [${i + 1}/${videoIds.length}] Fetching ${id}... `);
    const track = await fetchOEmbed(id);
    tracks.push(track);
    console.log(`✅ "${track.title}" - ${track.artist}`);
  }

  await fs.writeFile(tracksFilePath, JSON.stringify(tracks, null, 2), 'utf-8');
  console.log(`\n🎉 Successfully saved ${tracks.length} tracks into tracks.json!`);
}

main().catch(console.error);
