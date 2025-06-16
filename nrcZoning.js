/**
 * 2025-04-25 发布 2024 年县以上行政区划代码 https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html
 * 浏览器打开以上链接，在控制台粘贴以下代码运行
 * 
 * 乡级（乡镇街道）、 村级（村委会居委会）代码请选择旧版本 v2.2023.0
 */
let nrcZoning = {
    init: async () => {
        await nrcZoning.onReady();

        nrcZoning.onBuild();
        nrcZoning.onDiff();
    },
    tsBaseData: [],
    tsLatestData: [],
    tsOutput: {},

    onReady: async () => {
        let resp1 = await fetch("https://unpkg.com/zoningjs@2.2023.0/0.json");
        nrcZoning.tsBaseData = await resp1.json();

        let latestUrl = "https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html"
        let resp2 = await fetch(latestUrl);
        let text2 = await resp2.text();

        let dom2 = new DOMParser().parseFromString(text2, "text/html");
        dom2.querySelectorAll("table tr").forEach(tr => {
            let codeAndName = [];
            tr.querySelectorAll("td").forEach(td => {
                let txt = td.textContent.trim().replace("*", "");
                if (txt != "") {
                    codeAndName.push(txt);
                }
            });
            if (codeAndName.length) {
                nrcZoning.tsLatestData.push(codeAndName.join(" "));
            }
        });
    },

    onBuild: () => {
        // 省级（省份直辖市自治区） deep 1
        let lv1 = [];
        nrcZoning.tsBaseData.filter(x => x.pid == "0").forEach(item => {
            lv1.push({ c: parseInt(item.id), n: item.txt });
        });
        lv1.sort((a, b) => a.c - b.c);
        nrcZoning.tsOutput["0"] = lv1;

        // 地级（城市） deep 2
        lv1.forEach(item2 => {
            let lv2 = [];
            nrcZoning.tsBaseData.filter(x => x.spid == item2.c).forEach(item => {
                lv2.push({ c: parseInt(item.sid), n: item.txt });

                // 县级（区县） deep 3
                lv2.forEach(item3 => {
                    let lv3 = [];
                    nrcZoning.tsBaseData.filter(x => x.spid == item3.c).forEach(item => {
                        if (item.sid.length <= 6) {
                            lv3.push({ c: parseInt(item.sid), n: item.txt });
                        }
                    })
                    if (lv3.length) {
                        lv3.sort((a, b) => a.c - b.c);
                        nrcZoning.tsOutput[item3.c] = lv3;
                    }
                });
            })

            lv2.sort((a, b) => a.c - b.c);
            nrcZoning.tsOutput[item2.c] = lv2;
        });

        console.debug(nrcZoning.tsOutput);
        console.debug("Output List 0.json");
        console.debug(JSON.stringify(nrcZoning.tsOutput));
    },

    onDiff: () => {

        // 对比
        let outputList = [];
        nrcZoning.tsOutput["0"].forEach(item => {
            outputList.push(`${String(item.c).padEnd(6, "0")} ${item.n}`);
            (nrcZoning.tsOutput[item.c] || []).forEach(item1 => {
                outputList.push(`${String(item1.c).padEnd(6, "0")} ${item1.n}`);
                (nrcZoning.tsOutput[item1.c] || []).forEach(item2 => {
                    outputList.push(`${String(item2.c).padEnd(6, "0")} ${item2.n}`);
                });
            });
        });

        console.debug("Output List:");
        console.debug(outputList.join("\n"));

        console.debug("Latest List:");
        console.debug(nrcZoning.tsLatestData.join("\n"));

        console.debug("将 Output List 和 Latest List 对比，再更新 Output List 0.json");
        console.debug("diff https://ss.js.org/diff")
    }
};

await nrcZoning.init();