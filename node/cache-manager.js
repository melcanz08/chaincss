const fs = require('fs');
const path = require('path');
class CacheManager {
  constructor(cachePath = './.chaincss-cache') {
    this.cachePath = path.resolve(process.cwd(), cachePath);
    this.cacheDir = path.dirname(this.cachePath);
    this.cache = {};
    this.load();
  }
  load() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf8');
        this.cache = JSON.parse(data);
        //console.log(`Loaded cache from ${this.cachePath}`);
      } else {
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.cache = {
          version: '1.0',
          created: new Date().toISOString(),
          atomic: {},
          usage: {}
        };
      }
    } catch (error) {
      console.warn('Could not load cache, starting fresh:', error.message);
      this.cache = {};
    }
  }
  get(key) {
    return this.cache[key];
  }
  set(key, value) {
    this.cache[key] = value;
  }
  save() {
    try {
      const data = JSON.stringify(this.cache, null, 2);
      fs.writeFileSync(this.cachePath, data, 'utf8');
      //console.log(`Saved cache to ${this.cachePath}`);
    } catch (error) {
      console.warn('Could not save cache:', error.message);
    }
  }
  clear() {
    this.cache = {};
    if (fs.existsSync(this.cachePath)) {
      fs.unlinkSync(this.cachePath);
    }
    console.log('Cache cleared');
  }
}
module.exports = { CacheManager };