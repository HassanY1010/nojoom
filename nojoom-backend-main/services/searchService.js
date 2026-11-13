// services/searchService.js
import { pool, executeQuery } from '../config/db.js';

let esClient = null;

const initElasticsearch = async () => {
  if (esClient) return esClient;
  try {
    const { Client } = await import('@elastic/elasticsearch');
    const esUrl = process.env.ELASTICSEARCH_URL || process.env.OPENSEARCH_URL;
    if (esUrl) {
      esClient = new Client({
        node: esUrl,
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME || '',
          password: process.env.ELASTICSEARCH_PASSWORD || ''
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('🔍 Elasticsearch/OpenSearch client initialized');
    }
  } catch (error) {
    console.warn('⚠️ Elasticsearch client is not installed or failed to initialize, falling back to MySQL Full-Text Search:', error.message);
  }
  return esClient;
};

// Initialize on load
initElasticsearch();

class SearchService {
  // الفهرسة في Elasticsearch للفيديوهات
  async indexVideo(video) {
    try {
      const client = await initElasticsearch();
      if (!client) return;

      await client.index({
        index: 'videos',
        id: String(video.id),
        document: {
          id: video.id,
          title: video.title,
          description: video.description,
          category: video.category,
          user_id: video.user_id,
          tenant_id: video.tenant_id,
          is_public: video.is_public,
          views: video.views,
          created_at: video.created_at
        }
      });
      console.log(`📡 Video indexed in Elasticsearch: ${video.id}`);
    } catch (error) {
      console.error('Error indexing video in ES:', error.message);
    }
  }

  // حذف فيديو من الفهرس
  async deleteVideoFromIndex(videoId) {
    try {
      const client = await initElasticsearch();
      if (!client) return;

      await client.delete({
        index: 'videos',
        id: String(videoId)
      });
      console.log(`🗑️ Video removed from Elasticsearch index: ${videoId}`);
    } catch (error) {
      console.error('Error deleting video from ES index:', error.message);
    }
  }

  // الفهرسة في Elasticsearch للمستخدمين
  async indexUser(user) {
    try {
      const client = await initElasticsearch();
      if (!client) return;

      await client.index({
        index: 'users',
        id: String(user.id),
        document: {
          id: user.id,
          username: user.username,
          bio: user.bio,
          tenant_id: user.tenant_id,
          is_banned: user.is_banned
        }
      });
      console.log(`📡 User indexed in Elasticsearch: ${user.id}`);
    } catch (error) {
      console.error('Error indexing user in ES:', error.message);
    }
  }

  // البحث في الفيديوهات (يدعم خياري Elasticsearch و MySQL FTS)
  async searchVideos({ query, hashtags, filter, userId, tenantId, limit, offset }) {
    try {
      const client = await initElasticsearch();
      if (client && query) {
        // البحث باستخدام Elasticsearch
        console.log(`🔍 Querying Elasticsearch for videos: "${query}"`);
        const esResult = await client.search({
          index: 'videos',
          from: parseInt(offset) || 0,
          size: parseInt(limit) || 20,
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: query,
                    fields: ['title^2', 'description'],
                    fuzziness: 'AUTO'
                  }
                }
              ],
              filter: [
                { term: { is_public: true } },
                { term: { tenant_id: tenantId } }
              ]
            }
          }
        });

        const hits = esResult.hits?.hits || [];
        if (hits.length > 0) {
          const videoIds = hits.map(hit => hit._source.id);
          const placeholders = videoIds.map(() => '?').join(',');
          
          const sql = `
            SELECT 
              v.*, u.id as user_id, u.username, u.avatar, u.bio,
              v.likes as likes_count,
              (SELECT COUNT(*) FROM comments c WHERE c.video_id = v.id) as comment_count,
              ${userId ? '(SELECT EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = ?))' : 'FALSE'} as is_liked
            FROM videos v
            JOIN users u ON v.user_id = u.id
            WHERE v.id IN (${placeholders})
          `;
          
          const finalParams = userId ? [userId, ...videoIds] : [...videoIds];
          return await executeQuery(sql, finalParams);
        }
      }
    } catch (esError) {
      console.warn('⚠️ Elasticsearch search failed, falling back to MySQL FTS:', esError.message);
    }

    // بديل قاعدة البيانات السريع (MySQL Full-Text Search)
    let whereConditions = ['v.is_public = true', 'v.deleted_by_admin = false', 'u.is_banned = false', 'v.tenant_id = ?'];
    let orderBy = '';
    const params = [tenantId];

    if (query) {
      // استخدام MATCH AGAINST للبحث السريع بدلاً من LIKE
      whereConditions.push('MATCH(v.title, v.description) AGAINST(? IN NATURAL LANGUAGE MODE)');
      params.push(query);
    }

    if (hashtags?.length) {
      const hashtagCond = hashtags.map(() => 'v.description LIKE ?').join(' OR ');
      whereConditions.push(`(${hashtagCond})`);
      hashtags.forEach(t => params.push(`%${t}%`));
    }

    switch (filter) {
      case 'trending': orderBy = 'v.views DESC, v.likes DESC, v.created_at DESC'; break;
      case 'latest': orderBy = 'v.created_at DESC'; break;
      default: orderBy = 'v.created_at DESC';
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sql = `
      SELECT 
        v.*, u.id as user_id, u.username, u.avatar, u.bio,
        v.likes as likes_count,
        (SELECT COUNT(*) FROM comments c WHERE c.video_id = v.id) as comment_count,
        ${userId ? '(SELECT EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = ?))' : 'FALSE'} as is_liked
      FROM videos v
      JOIN users u ON v.user_id = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const finalParams = userId ? [userId, ...params, parseInt(limit), parseInt(offset)] : [...params, parseInt(limit), parseInt(offset)];
    return await executeQuery(sql, finalParams);
  }

  // البحث في المستخدمين (يدعم خياري Elasticsearch و MySQL FTS)
  async searchUsers({ query, userId, tenantId, limit, offset }) {
    try {
      const client = await initElasticsearch();
      if (client && query) {
        console.log(`🔍 Querying Elasticsearch for users: "${query}"`);
        const esResult = await client.search({
          index: 'users',
          from: parseInt(offset) || 0,
          size: parseInt(limit) || 20,
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: query,
                    fields: ['username^3', 'bio'],
                    fuzziness: 'AUTO'
                  }
                }
              ],
              filter: [
                { term: { is_banned: false } },
                { term: { tenant_id: tenantId } }
              ]
            }
          }
        });

        const hits = esResult.hits?.hits || [];
        if (hits.length > 0) {
          const userIds = hits.map(hit => hit._source.id);
          const placeholders = userIds.map(() => '?').join(',');

          const sql = `
            SELECT 
              u.*,
              COALESCE(u.followers_count, 0) as followers_count,
              COALESCE(u.following_count, 0) as following_count,
              ${userId ? '(SELECT EXISTS(SELECT 1 FROM follows f WHERE f.following_id = u.id AND f.follower_id = ?))' : 'FALSE'} as is_following
            FROM users u
            WHERE u.id IN (${placeholders})
          `;
          
          const finalParams = userId ? [userId, ...userIds] : [...userIds];
          return await executeQuery(sql, finalParams);
        }
      }
    } catch (esError) {
      console.warn('⚠️ Elasticsearch user search failed, falling back to MySQL FTS:', esError.message);
    }

    // بديل قاعدة البيانات السريع (MySQL Full-Text Search)
    const params = [tenantId];
    let whereConditions = ['u.is_banned = false', 'u.tenant_id = ?'];

    if (query) {
      whereConditions.push('MATCH(u.username, u.bio) AGAINST(? IN NATURAL LANGUAGE MODE)');
      params.push(query);
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sql = `
      SELECT 
        u.*,
        COALESCE(u.followers_count, 0) as followers_count,
        COALESCE(u.following_count, 0) as following_count,
        ${userId ? '(SELECT EXISTS(SELECT 1 FROM follows f WHERE f.following_id = u.id AND f.follower_id = ?))' : 'FALSE'} as is_following
      FROM users u
      ${whereClause}
      ORDER BY u.username ASC
      LIMIT ? OFFSET ?
    `;

    const finalParams = userId ? [userId, ...params, parseInt(limit), parseInt(offset)] : [...params, parseInt(limit), parseInt(offset)];
    return await executeQuery(sql, finalParams);
  }

  async searchByHashtag(hashtag, userId, tenantId, limit, offset) {
    const sql = `
      SELECT 
        v.*, u.id as user_id, u.username, u.avatar,
        (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as likes_count,
        (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = ?)) as is_liked
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.status = 'active' AND v.description LIKE ? AND v.tenant_id = ?
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await executeQuery(sql, [userId || 0, `%${hashtag}%`, tenantId, parseInt(limit), parseInt(offset)]);
  }

  // الحصول على الهاشتاجات الرائجة
  async getTrendingHashtags(limit = 10, tenantId, country = 'Global') {
    try {
      let sql = `
        SELECT description 
        FROM videos 
        WHERE is_public = true AND deleted_by_admin = false AND tenant_id = ?
      `;
      const params = [tenantId];

      if (country && country !== 'Global') {
        sql += ' AND country = ?';
        params.push(country);
      }

      sql += ' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';

      const videos = await executeQuery(sql, params);

      const hashtagCount = {};
      videos.forEach(video => {
        const matches = video.description?.match(/#[\w\u0600-\u06FF]+/g) || [];
        matches.forEach(hashtag => {
          hashtagCount[hashtag] = (hashtagCount[hashtag] || 0) + 1;
        });
      });

      const sortedHashtags = Object.entries(hashtagCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([hashtag]) => hashtag.replace('#', ''));

      return sortedHashtags;
    } catch (error) {
      console.error('Trending hashtags error:', error);
      throw error;
    }
  }

  async getTrendingVideos(tenantId, country = 'Global', limit = 10) {
    try {
      let sql = `
        SELECT v.*, u.username, u.avatar
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.is_public = true AND v.deleted_by_admin = false AND u.is_banned = false AND v.tenant_id = ?
      `;
      const params = [tenantId];

      if (country && country !== 'Global') {
        sql += ' AND v.country = ?';
        params.push(country);
      }

      sql += ' ORDER BY v.boost_score DESC, v.views DESC, v.created_at DESC LIMIT ?';
      params.push(parseInt(limit));

      return await executeQuery(sql, params);
    } catch (error) {
      console.error('Trending videos error:', error);
      throw error;
    }
  }

  // الاقتراحات التلقائية
  async getSearchSuggestions(query, limit = 5) {
    try {
      const [users, videos, hashtags] = await Promise.all([
        executeQuery(
          'SELECT username, avatar FROM users WHERE username LIKE ? AND is_banned = false LIMIT ?',
          [`%${query}%`, limit]
        ),
        executeQuery(
          'SELECT id, description, thumbnail FROM videos WHERE description LIKE ? AND is_public = true AND deleted_by_admin = false LIMIT ?',
          [`%${query}%`, limit]
        ),
        this.getTrendingHashtags(limit)
      ]);

      const suggestions = [
        ...users.map(user => ({
          type: 'user',
          text: user.username,
          avatar: user.avatar
        })),
        ...videos.map(video => ({
          type: 'video',
          text: video.description && video.description.length > 50
            ? video.description.substring(0, 50) + '...'
            : video.description,
          id: video.id,
          thumbnail: video.thumbnail
        })),
        ...hashtags.filter(h => h.toLowerCase().includes(query.toLowerCase().replace('#', '')))
          .map(hashtag => ({ type: 'hashtag', text: `#${hashtag}` }))
      ];

      return suggestions.sort((a, b) => {
        const aMatch = a.text.toLowerCase().startsWith(query.toLowerCase().replace(/[#@]/g, ''));
        const bMatch = b.text.toLowerCase().startsWith(query.toLowerCase().replace(/[#@]/g, ''));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      }).slice(0, limit);
    } catch (error) {
      console.error('Search suggestions error:', error);
      throw error;
    }
  }

  // تسجيل تفاعل البحث
  async recordSearchInteraction(userId, videoId, type, weight, metadata, tenantId) {
    try {
      const sql = `
        INSERT INTO search_interactions (user_id, video_id, interaction_type, weight, metadata, tenant_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      await executeQuery(sql, [userId, videoId, type, weight, JSON.stringify(metadata || {}), tenantId]);
    } catch (error) {
      console.error('Record search interaction error:', error);
      throw error;
    }
  }

  // تسجيل تاريخ البحث
  async recordSearchHistory(userId, query, searchType, tenantId) {
    try {
      const sql = `
        INSERT INTO search_history (user_id, query, search_type, tenant_id, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;
      await executeQuery(sql, [userId, query, searchType, tenantId]);
    } catch (error) {
      console.error('Record search history error:', error);
    }
  }

  // الحصول على تاريخ البحث
  async getUserSearchHistory(userId, tenantId, limit = 10) {
    try {
      const sql = `
        SELECT query, search_type, created_at 
        FROM search_history 
        WHERE user_id = ? AND tenant_id = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const history = await executeQuery(sql, [userId, tenantId, parseInt(limit)]);
      return history;
    } catch (error) {
      console.error('Get search history error:', error);
      throw error;
    }
  }

  // مسح تاريخ البحث
  async clearUserSearchHistory(userId, tenantId) {
    try {
      const sql = 'DELETE FROM search_history WHERE user_id = ? AND tenant_id = ?';
      await executeQuery(sql, [userId, tenantId]);
    } catch (error) {
      console.error('Clear search history error:', error);
      throw error;
    }
  }

  // التوصيات بناءً على البحث
  async getSearchBasedRecommendations(query, userId, tenantId, limit = 5) {
    try {
      const relatedTags = await this.extractRelatedTags(query);

      let recommendations = [];

      if (userId) {
        recommendations = await this.getPersonalizedRecommendations(userId, tenantId, relatedTags, limit);
      } else {
        recommendations = await this.getGeneralRecommendations(tenantId, relatedTags, limit);
      }

      return recommendations;
    } catch (error) {
      console.error('Search recommendations error:', error);
      throw error;
    }
  }

  async extractRelatedTags(query) {
    if (!query) return [];

    const commonTags = {
      'music': ['song', 'artist', 'band', 'music'],
      'sports': ['football', 'basketball', 'soccer', 'game'],
      'comedy': ['funny', 'joke', 'humor', 'comedy'],
      'education': ['learn', 'tutorial', 'howto', 'education']
    };

    const tags = [];
    const lowerQuery = query.toLowerCase();

    Object.entries(commonTags).forEach(([category, related]) => {
      if (related.some(tag => lowerQuery.includes(tag))) {
        tags.push(category);
      }
    });

    return tags;
  }

  async getPersonalizedRecommendations(userId, tenantId, tags, limit) {
    try {
      let whereCondition = 'v.status = "active" AND v.tenant_id = ?';
      const params = [tenantId];

      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'v.description LIKE ?');
        whereCondition += ` AND (${tagConditions.join(' OR ')})`;
        tags.forEach(tag => params.push(`%${tag}%`));
      }

      const sql = `
        SELECT 
          v.*,
          u.id as user_id,
          u.username,
          u.avatar,
          (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as likes_count
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE ${whereCondition}
        ORDER BY v.views DESC, v.created_at DESC
        LIMIT ?
      `;

      const results = await executeQuery(sql, [...params, parseInt(limit)]);
      return results;
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      throw error;
    }
  }

  async getGeneralRecommendations(tenantId, tags, limit) {
    try {
      let whereCondition = 'v.status = "active" AND v.tenant_id = ?';
      const params = [tenantId];

      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'v.description LIKE ?');
        whereCondition += ` AND (${tagConditions.join(' OR ')})`;
        tags.forEach(tag => params.push(`%${tag}%`));
      }

      const sql = `
        SELECT 
          v.*,
          u.id as user_id,
          u.username,
          u.avatar,
          (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as likes_count
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE ${whereCondition}
        ORDER BY v.views DESC, v.created_at DESC
        LIMIT ?
      `;

      const results = await executeQuery(sql, [...params, parseInt(limit)]);
      return results;
    } catch (error) {
      console.error('General recommendations error:', error);
      throw error;
    }
  }
}

export default new SearchService();