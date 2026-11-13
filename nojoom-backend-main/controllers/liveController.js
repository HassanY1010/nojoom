import { LiveStream } from '../models/LiveStream.js';

export const liveController = {
    async startStream(req, res) {
        try {
            const hostId = req.user.id;
            const { title } = req.body;

            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }

            const streamId = await LiveStream.create(hostId, title, req.tenantId);
            const stream = await LiveStream.findById(streamId, req.tenantId);

            res.status(201).json({
                message: 'Stream started successfully',
                stream
            });
        } catch (error) {
            console.error('Error starting stream:', error);
            res.status(500).json({ error: 'Failed to start stream' });
        }
    },

    async getActiveStreams(req, res) {
        try {
            const streams = await LiveStream.getActiveStreams(req.tenantId);
            res.json({ streams });
        } catch (error) {
            console.error('Error fetching active streams:', error);
            res.status(500).json({ error: 'Failed to fetch active streams' });
        }
    },

    async getStreamById(req, res) {
        try {
            const { id } = req.params;
            const stream = await LiveStream.findById(id, req.tenantId);

            if (!stream) {
                return res.status(404).json({ error: 'Stream not found' });
            }

            res.json({ stream });
        } catch (error) {
            console.error('Error fetching stream:', error);
            res.status(500).json({ error: 'Failed to fetch stream' });
        }
    },

    async endStream(req, res) {
        try {
            const { id } = req.params;
            const hostId = req.user.id;

            const stream = await LiveStream.findById(id);
            if (!stream) {
                return res.status(404).json({ error: 'Stream not found' });
            }

            if (stream.host_id !== hostId && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized to end this stream' });
            }

            await LiveStream.endStream(id, req.tenantId);
            res.json({ message: 'Stream ended successfully' });
        } catch (error) {
            console.error('Error ending stream:', error);
            res.status(500).json({ error: 'Failed to end stream' });
        }
    }
};
