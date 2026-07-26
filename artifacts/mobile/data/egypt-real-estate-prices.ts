// Moved to @workspace/shared-data so the backend's AI Assistant context can
// use the exact same dataset instead of a separately-maintained copy that
// could silently drift out of sync. Re-exported here so existing imports
// throughout the mobile app don't need to change.
export * from '@workspace/shared-data';
