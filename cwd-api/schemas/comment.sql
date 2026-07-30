-- create comment table
CREATE TABLE IF NOT EXISTS Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created INTEGER NOT NULL,
    post_slug TEXT NOT NULL,
    post_url TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    url TEXT,
    ip_address TEXT,
    device TEXT,
    os TEXT,
    browser TEXT,
    ua TEXT,
    content_text TEXT NOT NULL,
    content_html TEXT NOT NULL,
    parent_id INTEGER,
    likes INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'approved',
    site_id TEXT NOT NULL DEFAULT '',
    -- 建立自引用外键约束（父子评论关系）
    FOREIGN KEY (parent_id) REFERENCES Comment (id) ON DELETE SET NULL
);

-- 可选：为常用查询字段创建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_post_slug ON Comment(post_slug);
CREATE INDEX IF NOT EXISTS idx_status ON Comment(status);
CREATE INDEX IF NOT EXISTS idx_site_id ON Comment(site_id);
