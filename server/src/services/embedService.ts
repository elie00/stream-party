import * as cheerio from 'cheerio';

export type EmbedType = 'link' | 'image' | 'video' | 'article';

export interface EmbedData {
  type: EmbedType;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

// Common emoji pattern for quick emoji detection
const EMOJI_REGEX = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]$/u;

/**
 * Validates if a string is a single emoji
 */
export function isValidEmoji(emoji: string): boolean {
  if (!emoji || emoji.length === 0) return false;
  // Allow single emoji or emoji with skin tone modifiers
  return EMOJI_REGEX.test(emoji) || /^[\p{Emoji}\p{Emoji_Modifier}]+$/u.test(emoji);
}

/**
 * Extract URLs from message content
 */
export function extractUrls(content: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;
  const matches = content.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Determine embed type from URL and content type
 */
function determineEmbedType(url: string, contentType: string = ''): EmbedType {
  const lowerUrl = url.toLowerCase();
  const lowerContentType = contentType.toLowerCase();

  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(lowerUrl) || 
      lowerContentType.startsWith('image/')) {
    return 'image';
  }

  // Video extensions and platforms
  if (/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(lowerUrl) ||
      lowerContentType.startsWith('video/') ||
      /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(lowerUrl)) {
    return 'video';
  }

  return 'link';
}

/**
 * Get YouTube video ID from URL
 */
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Get YouTube thumbnail URL
 */
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Fetch and parse OpenGraph metadata from a URL
 */
export async function fetchEmbedData(url: string): Promise<EmbedData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamPartyBot/1.0; +https://streamparty.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const embedType = determineEmbedType(url, contentType);

    // For images, return basic data without parsing HTML
    if (embedType === 'image') {
      return {
        type: 'image',
        url,
        title: url.split('/').pop() || 'Image',
      };
    }

    // For videos, check if it's YouTube for thumbnail
    if (embedType === 'video') {
      const youtubeId = getYouTubeVideoId(url);
      if (youtubeId) {
        return {
          type: 'video',
          url,
          title: 'YouTube Video',
          image: getYouTubeThumbnail(youtubeId),
          siteName: 'YouTube',
        };
      }
    }

    // Parse HTML for OpenGraph metadata
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract OpenGraph metadata
    const ogTitle = $('meta[property="og:title"]').attr('content') ||
                    $('meta[name="twitter:title"]').attr('content') ||
                    $('title').text();
    
    const ogDescription = $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="twitter:description"]').attr('content') ||
                          $('meta[name="description"]').attr('content');
    
    const ogImage = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content');
    
    const ogSiteName = $('meta[property="og:site_name"]').attr('content') ||
                       new URL(url).hostname;

    // Determine final type from OpenGraph type
    const ogType = $('meta[property="og:type"]').attr('content');
    let finalType: EmbedType = embedType;
    
    if (ogType?.includes('video')) {
      finalType = 'video';
    } else if (ogType?.includes('article')) {
      finalType = 'article';
    }

    return {
      type: finalType,
      url,
      title: ogTitle?.trim().slice(0, 200), // Limit title length
      description: ogDescription?.trim().slice(0, 400), // Limit description length
      image: ogImage,
      siteName: ogSiteName,
    };
  } catch (error) {
    console.error(`Error fetching embed for ${url}:`, error);
    return null;
  }
}

/**
 * Generate embeds for all URLs in a message
 */
export async function generateEmbedsForMessage(content: string): Promise<EmbedData[]> {
  const urls = extractUrls(content);
  const embeds: EmbedData[] = [];

  // Limit to 3 embeds per message
  const urlsToProcess = urls.slice(0, 3);

  for (const url of urlsToProcess) {
    const embedData = await fetchEmbedData(url);
    if (embedData) {
      embeds.push(embedData);
    }
  }

  return embeds;
}
