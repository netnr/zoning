/**
 * 民政部全国行政区划信息查询平台 https://dmfw.mca.gov.cn/XzqhVersionPublish.html
 * 浏览器打开以上链接（必须保持在该域名页面下），在控制台粘贴以下代码运行
 *
 * 输出两个结果：
 *   0.json  省市区（三级）
 *   4.json 省市区 + 街道/乡镇（四级）
 *
 * 抓取频率 QoS 限制为 1（串行请求），关键步骤有进度输出与语音播报
 */
let nrcZoning = {
    tsConfig: {
        LIST_API: "https://dmfw.mca.gov.cn/xzqh/getList",      // 接口1：省市区
        CODE_API: "https://dmfw.mca.gov.cn/xzqh/getCodeList",  // 接口2：街道/乡镇
        TABLE_NAME: "Xzqh20251231", // 行政区划快照版本（接口2必填）
        MAX_LEVEL: 3,
        REQUEST_INTERVAL: 2000,     // 每次真实请求最小间隔（毫秒），QoS=1 串行抓取，缓存命中不计
        MAX_RETRY: 3,               // 单个请求失败重试次数
        VOICE: true,                // 语音播报开关
        DOWNLOAD: false,             // 完成后自动下载 0.json / 4.json
        LOCALFORAGE_CDN: "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js",
        CACHE_NAME: "nrcZoning",    // localforage 库名
        CACHE_STORE: "xzqh_cache",  // localforage 存储表名
    },

    tsTree: [],     // 接口1原始树（省级节点列表）
    tsOutput: {},   // 0.json 输出
    tsOutput4: {},  // 4.json 四级部分（key 为区县代码）
    tsQueue: [],    // 四级抓取队列 { key, parentCode, name }
    tsFailed: [],   // 抓取失败队列
    tsStore: null,  // localforage 缓存实例

    init: async () => {
        nrcZoning.speak("开始抓取行政区划数据");
        await nrcZoning.onLoadCache();
        await nrcZoning.onReady();
        nrcZoning.onBuild();
        await nrcZoning.onCrawl();
        nrcZoning.onOutput();
    },

    // 加载 localforage 并初始化缓存
    onLoadCache: async () => {
        let cfg = nrcZoning.tsConfig;
        if (!window.localforage) {
            await new Promise((resolve, reject) => {
                let script = document.createElement("script");
                script.src = cfg.LOCALFORAGE_CDN;
                script.onload = resolve;
                script.onerror = () => reject(new Error("localforage 加载失败"));
                document.head.appendChild(script);
            });
        }
        nrcZoning.tsStore = window.localforage.createInstance({
            name: cfg.CACHE_NAME,
            storeName: cfg.CACHE_STORE,
        });
        console.info(`[0/4] 缓存就绪（按 code 缓存，优先读缓存，未命中再请求）`);
    },

    // 清空缓存：控制台执行 await nrcZoning.onClearCache()
    onClearCache: async () => {
        await nrcZoning.tsStore.clear();
        console.info("缓存已清空");
    },

    // 接口1：获取省市区三级
    onReady: async () => {
        let cfg = nrcZoning.tsConfig;
        let cacheKey = "list:0";
        let cached = await nrcZoning.tsStore.getItem(cacheKey);
        if (cached) {
            nrcZoning.tsTree = cached;
            console.info(`[1/4] 省市区数据命中缓存，省级节点 ${nrcZoning.tsTree.length} 个`);
            return;
        }
        let url = `${cfg.LIST_API}?code=0&trimCode=true&maxLevel=${cfg.MAX_LEVEL}&_=${Date.now()}`;
        console.info(`[1/4] 请求省市区数据 ${url}`);
        let resp = await fetch(url);
        let json = await resp.json();
        if (json.status !== 200 || !json.data || !json.data.children) {
            throw new Error(`省市区数据请求失败: ${json.message || resp.status}`);
        }
        nrcZoning.tsTree = json.data.children;
        await nrcZoning.tsStore.setItem(cacheKey, nrcZoning.tsTree);
        console.info(`[1/4] 省级节点 ${nrcZoning.tsTree.length} 个，已写入缓存`);
    },

    // 组装 0.json（省市区），并生成四级抓取队列
    onBuild: () => {
        let output = {};
        let queue = [];

        // 省级（deep 1）：过滤非数字代码（如台湾省“资料暂缺”）
        let provinces = nrcZoning.tsTree.filter(x => /^\d+$/.test(x.code));
        nrcZoning.tsTree.filter(x => !/^\d+$/.test(x.code)).forEach(x => {
            console.warn(`跳过无代码节点: ${x.name} (${x.code})`);
        });
        provinces.sort((a, b) => parseInt(a.code) - parseInt(b.code));
        output["0"] = provinces.map(x => ({ c: parseInt(x.code), n: x.name }));

        let lv2Count = 0, lv3Count = 0;
        provinces.forEach(p => {
            let cities = [];      // 地级（deep 2）
            let directGroups = {}; // 省直辖县级节点按前 4 位分组（直辖市区/省直辖县）

            (p.children || []).forEach(c => {
                if (c.code.length <= 4) {
                    // 地级市
                    cities.push({ c: parseInt(c.code), n: c.name });
                    lv2Count++;
                    let districts = (c.children || [])
                        .filter(x => /^\d{6}$/.test(x.code))
                        .map(x => ({ c: parseInt(x.code), n: x.name }));
                    if (districts.length) {
                        districts.sort((a, b) => a.c - b.c);
                        output[c.code] = districts;
                        districts.forEach(d => queue.push({
                            key: String(d.c), parentCode: String(d.c),
                            name: `${p.name}/${c.name}/${d.n}`,
                        }));
                        lv3Count += districts.length;
                    } else {
                        // 直筒子市（东莞市/中山市/儋州市/嘉峪关市）：无区县，以 code+"00" 直接抓街道
                        let key = c.code + "00";
                        queue.push({ key, parentCode: key, name: `${p.name}/${c.name}` });
                    }
                } else if (/^\d{6}$/.test(c.code)) {
                    // 直辖市的区 / 省直辖县级行政单位
                    let g = c.code.slice(0, 4);
                    (directGroups[g] = directGroups[g] || []).push(c);
                }
            });

            // 合成虚拟地级市节点：与历史 0.json 结构保持一致
            Object.keys(directGroups).sort().forEach(g => {
                let name = p.type === "直辖市"
                    ? (g.endsWith("02") ? "县" : "市辖区")
                    : "省直辖县级行政单位";
                cities.push({ c: parseInt(g), n: name });
                let districts = directGroups[g].map(x => ({ c: parseInt(x.code), n: x.name }));
                districts.sort((a, b) => a.c - b.c);
                output[g] = districts;
                districts.forEach(d => queue.push({
                    key: String(d.c), parentCode: String(d.c),
                    name: `${p.name}/${name}/${d.n}`,
                }));
                lv3Count += districts.length;
            });

            if (cities.length) {
                cities.sort((a, b) => a.c - b.c);
                output[p.code] = cities;
            } else {
                console.warn(`${p.name} 无下级数据`);
            }
        });

        nrcZoning.tsOutput = output;
        nrcZoning.tsQueue = queue;
        console.info(`[2/4] 0.json 组装完成: 省 ${provinces.length} / 市 ${lv2Count} / 区县 ${lv3Count}，待抓街道队列 ${queue.length} 个`);
        nrcZoning.speak(`省市区数据抓取完成，开始抓取街道乡镇，共 ${queue.length} 个区县`);
    },

    // 接口2：串行抓取街道/乡镇（QoS=1）
    onCrawl: async () => {
        let cfg = nrcZoning.tsConfig;
        let queue = nrcZoning.tsQueue;
        let total = queue.length;
        let t0 = Date.now();
        let lastVoicePct = -1;

        for (let i = 0; i < total; i++) {
            let task = queue[i];
            let result = await nrcZoning.fetchStreet(task.parentCode);
            if (result === null) {
                nrcZoning.tsFailed.push(task);
                console.warn(`[${i + 1}/${total}] 失败 ${task.key} ${task.name}`);
            } else {
                let list = result.rows
                    .filter(x => /^\d{9}$/.test(x.code))
                    .map(x => ({ c: parseInt(x.code), n: x.name }));
                list.sort((a, b) => a.c - b.c);
                if (list.length) {
                    nrcZoning.tsOutput4[task.key] = list;
                }
                let pct = ((i + 1) / total * 100).toFixed(1);
                let elapsed = ((Date.now() - t0) / 1000).toFixed(0);
                let tag = result.cached ? "[缓存]" : "[请求]";
                console.log(`[${i + 1}/${total}] ${pct}% 已用时${elapsed}s ${tag} ${task.key} ${task.name} -> ${list.length} 条`);
                let pctInt = Math.floor((i + 1) / total * 100);
                if (pctInt % 10 === 0 && pctInt !== lastVoicePct) {
                    lastVoicePct = pctInt;
                    nrcZoning.speak(`已完成 ${pctInt}%`);
                }
            }
            // 仅真实请求后等待，保证接口请求间隔至少 REQUEST_INTERVAL 毫秒；缓存命中不限速
            if (result === null || !result.cached) {
                await nrcZoning.sleep(cfg.REQUEST_INTERVAL);
            }
        }

        let ok = total - nrcZoning.tsFailed.length;
        console.info(`[3/4] 街道/乡镇抓取完成: 成功 ${ok} / 失败 ${nrcZoning.tsFailed.length}，耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`);
    },

    // 失败重试：全部完成后可在控制台执行 await nrcZoning.onRetry()
    onRetry: async () => {
        if (!nrcZoning.tsFailed.length) {
            console.info("无失败项");
            return;
        }
        console.info(`重试 ${nrcZoning.tsFailed.length} 个失败项`);
        nrcZoning.tsQueue = nrcZoning.tsFailed;
        nrcZoning.tsFailed = [];
        await nrcZoning.onCrawl();
        nrcZoning.onOutput();
    },

    // 接口2 单条请求（含重试、按 parentCode 缓存），返回 { rows, cached } 或 null
    fetchStreet: async (parentCode) => {
        let cfg = nrcZoning.tsConfig;
        let cacheKey = `street:${parentCode}`;
        let cached = await nrcZoning.tsStore.getItem(cacheKey);
        if (cached) {
            return { rows: cached, cached: true };
        }
        let body = `parentCode=${parentCode}&placeCode=&title=&tableName=${cfg.TABLE_NAME}&type=2`;
        for (let attempt = 1; attempt <= cfg.MAX_RETRY; attempt++) {
            try {
                let resp = await fetch(cfg.CODE_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                });
                let json = await resp.json();
                if (json.status === 200 && Array.isArray(json.data)) {
                    await nrcZoning.tsStore.setItem(cacheKey, json.data);
                    return { rows: json.data, cached: false };
                }
                throw new Error(json.message || `HTTP ${resp.status}`);
            } catch (e) {
                console.warn(`请求失败(${attempt}/${cfg.MAX_RETRY}) parentCode=${parentCode}`, e);
                await nrcZoning.sleep(1000 * attempt);
            }
        }
        return null;
    },

    // 输出 0.json / 4.json
    onOutput: () => {
        let output4 = Object.assign({}, nrcZoning.tsOutput, nrcZoning.tsOutput4);

        console.debug("Output 0.json （省市区）:");
        console.debug(JSON.stringify(nrcZoning.tsOutput));
        console.debug("Output 4.json （省市区 + 街道/乡镇）:");
        console.debug(JSON.stringify(output4));

        if (nrcZoning.tsConfig.DOWNLOAD) {
            nrcZoning.download("0.json", nrcZoning.tsOutput);
            nrcZoning.download("4.json", output4);
        }

        if (nrcZoning.tsFailed.length) {
            console.warn(`有 ${nrcZoning.tsFailed.length} 个区县抓取失败，可执行 await nrcZoning.onRetry() 重试`);
            nrcZoning.speak(`抓取完成，但有 ${nrcZoning.tsFailed.length} 个失败项`);
        } else {
            nrcZoning.speak("全部抓取完成");
        }
        console.info("[4/4] 完成，结果已通过下载/控制台输出");
    },

    download: (filename, obj) => {
        let blob = new Blob([JSON.stringify(obj, null, 4)], { type: "application/json" });
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    speak: (text) => {
        console.info(`[播报] ${text}`);
        if (!nrcZoning.tsConfig.VOICE || !window.speechSynthesis) return;
        let utter = new SpeechSynthesisUtterance(text);
        utter.lang = "zh-CN";
        window.speechSynthesis.speak(utter);
    },

    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};

await nrcZoning.init();
