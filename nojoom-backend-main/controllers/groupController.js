import { Group } from '../models/Group.js';

export const groupController = {
    async createGroup(req, res) {
        try {
            const { name, description } = req.body;
            const creator_id = req.user.id;
            const avatar = req.file ? `/uploads/groups/${req.file.filename}` : '/uploads/groups/default-group.png';

            const groupId = await Group.create({ tenant_id: req.tenantId, name, description, image: avatar, creator_id });
            const group = await Group.findById(groupId, req.tenantId);

            res.status(201).json({
                success: true,
                message: 'Group created successfully',
                data: group
            });
        } catch (error) {
            console.error('Create group error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async listGroups(req, res) {
        try {
            const userId = req.user?.id;
            const tenantId = req.tenantId || req.tenant?.id || 1;
            const { limit = 50, offset = 0 } = req.query;
            const groups = await Group.listAll(userId, tenantId, parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

            res.json({
                success: true,
                data: groups || [],
                groups: groups || []
            });
        } catch (error) {
            console.error('List groups error:', error);
            res.json({
                success: true,
                data: [],
                groups: []
            });
        }
    },

    async getGroupDetails(req, res) {
        try {
            const { id } = req.params;
            const group = await Group.findById(id, req.tenantId);

            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }

            const members = await Group.getMembers(id);

            res.json({
                success: true,
                data: { ...group, members }
            });
        } catch (error) {
            console.error('Get group details error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async joinGroup(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const success = await Group.join(id, userId);

            if (success) {
                res.json({ success: true, message: 'Joined group successfully' });
            } else {
                res.status(400).json({ error: 'Failed to join group or already a member' });
            }
        } catch (error) {
            console.error('Join group error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async leaveGroup(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const success = await Group.leave(id, userId);

            if (success) {
                res.json({ success: true, message: 'Left group successfully' });
            } else {
                res.status(400).json({ error: 'Failed to leave group (Creator cannot leave)' });
            }
        } catch (error) {
            console.error('Leave group error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async getUserGroups(req, res) {
        try {
            const userId = req.user.id;
            const groups = await Group.getUserGroups(userId);

            res.json({
                success: true,
                data: groups
            });
        } catch (error) {
            console.error('Get user groups error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
