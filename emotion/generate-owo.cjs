/**
 * 自动扫描 emotion/ 目录，生成 OwO.json
 *
 * 工作原理：
 * 1. 读取 emoticons.json（颜文字等文本表情，手动维护）
 * 2. 扫描所有子目录（如 aru/、twemoji/），每个子目录视为一个图片表情包
 * 3. 如果子目录中有 meta.json，使用其中的 displayName 和 items（图标文字标签）
 * 4. 如果没有 meta.json，用目录名作为显示名，文件名作为图标文字
 * 5. 合并所有内容，生成 OwO.json
 *
 * 添加新表情包只需：
 *   1. 在 emotion/ 下新建文件夹（如 mypack/）
 *   2. 放入 .png 图片
 *   3. （可选）创建 meta.json 自定义显示名和文字标签
 *   4. 重新部署即可
 */
const fs = require('fs');
const path = require('path');

/**
 * 生成最终站点中可直接访问的表情图片地址。
 *
 * @param {string} packName - 表情包目录名。
 * @param {string} fileName - 图片文件名。
 * @returns {string}
 */
function buildEmotionUrl(packName, fileName) {
	return `/emotion/${packName}/${fileName}`;
}

/**
 * 扫描 emotion 目录并生成可直接使用的 OwO JSON 集合。
 */
function run() {
	const emotionDir = path.resolve(__dirname);

	// 1. 读取文本表情（颜文字等），稍后追加到最后
	const emoticonsPath = path.join(emotionDir, 'emoticons.json');
	const result = {};
	let emoticons = {};

	if (fs.existsSync(emoticonsPath)) {
		emoticons = JSON.parse(fs.readFileSync(emoticonsPath, 'utf-8'));
		console.log('[Generate-OwO] Loaded emoticons.json');
	}

	// 2. 扫描子目录，生成图片表情包
	const packOrder = ['twemoji', 'aru'];
	const entries = fs.readdirSync(emotionDir, { withFileTypes: true })
		.filter(entry => entry.isDirectory() && entry.name !== 'node_modules')
		.sort((a, b) => {
			const indexA = packOrder.indexOf(a.name);
			const indexB = packOrder.indexOf(b.name);
			if (indexA !== -1 || indexB !== -1) {
				return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
			}
			return a.name.localeCompare(b.name);
		});
	for (const entry of entries) {
		const packDir = path.join(emotionDir, entry.name);
		const metaPath = path.join(packDir, 'meta.json');

		// 读取 meta.json（可选）
		let meta = {};
		if (fs.existsSync(metaPath)) {
			try {
				meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
			} catch (e) {
				console.warn(`[Generate-OwO] Failed to parse ${entry.name}/meta.json: ${e.message}`);
			}
		}

		// 扫描 .png 文件
		const pngFiles = fs.readdirSync(packDir)
			.filter(f => f.toLowerCase().endsWith('.png'))
			.sort();

		if (pngFiles.length === 0) continue;

		const displayName = meta.displayName || entry.name;
		const itemsMap = meta.items || {};

		const container = pngFiles.map(file => {
			const iconName = path.basename(file, '.png');
			return {
				icon: iconName,
				text: itemsMap[iconName] || iconName,
				url: buildEmotionUrl(entry.name, file),
			};
		});

		result[displayName] = {
			type: 'image',
			name: entry.name,
			container,
		};

		console.log(`[Generate-OwO] Scanned pack "${entry.name}" (${displayName}): ${container.length} icons`);
	}

	Object.assign(result, emoticons);

	// 3. 写入 OwO.json
	const owoPath = path.join(emotionDir, 'OwO.json');
	fs.writeFileSync(owoPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
	console.log(`[Generate-OwO] Generated OwO.json with ${Object.keys(result).length} categories`);
}

run();
