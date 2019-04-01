# zoning

 **中华人民共和国行政区划：省级、地级、县级、乡级和村级** 

----------
> Gitee <https://gitee.com/netnr/zoning>

> GitHub <https://github.com/netnr/zoning>

----------

> Demo <https://ss.netnr.com/zoning>

----------
# [变更日志](CHANGELOG.md)

----------
# 来源

 **国家统计局 - 统计用区划和城乡划分代码** 

 统计数据截止2017-10-31 于 2018-06-20发布

<http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/>

<http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2017>

----------
# 使用
- 打开页面 <http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2017/index.html>
- 打开浏览器控制台（推荐Chrome、Firefox，请不要用IE系列，谢谢）
- 拷贝脚本`zoning.js`的内容粘贴到控制台运行

- 首次抓取会出现大量失败请求，再次抓取会从浏览器缓存获取，非常快
- Chrome比较快，会出现几个链接抓取失败
- Firefox比较稳定，抓取有保障，内存占用高（推荐，测试版本：61.0.2 64-bit）

- `build.html`用于导出的`JSON`文件生成`SQLite`和`CSV`
- `CSV`导出编码为`utf-8`，Excel打开中文会乱码，需要转换编码为`ANSI` 或 `指定BOM`

----------
# 发布
- 支持的格式有：`JSON`文件、`SQLite`数据库、`CSV`文件、`SQL`脚本

- `0.json`根数据
- `zoning-*.json`所有数据， `zoning-*.db`SQLite数据库， `zoning-*.csv`CSV文件，`zoning-*.sql`SQL脚本

- `dist/zoning-5` 五级（全部数据，已发布npm，<https://unpkg.com/netnr-zoning/>）
- `dist/zoning-4` 四级
- `dist/zoning-3` 三级

----------
# 代码
```js
/*
 * https://github.com/netnr/zoning
 * 
 * 2019-01-28
 * netnr
 */

var zoning = {
    //版本号
    version: "2.0.0",
    //载入js脚本
    getScript: function (src, success) {
        var ele = document.createElement("SCRIPT");
        ele.src = src;
        ele.type = "text/javascript";
        document.getElementsByTagName("HEAD")[0].appendChild(ele);
        //加载完成回调
        if (success != undefined) {
            ele.onload = ele.onreadystatechange = function () {
                if (!this.readyState || this.readyState == "loaded" || this.readyState == "complete") { success(); }
            }
        }
    },
    //参数配置
    config: {
        //jszip CDN
        urljszip: "https://lib.baomitu.com/jszip/3.1.4/jszip.min.js",
        //fileSaver CDN
        urlfilesaver: "https://lib.baomitu.com/FileSaver.js/2014-11-29/FileSaver.min.js",
        //抓取首页
        urlprefix: "http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2017/",
        //起始深度
        deep: 1,
        //最大深度
        //5 村 约46800
        //4 街道 约3380
        deepmax: 3,
        //抓取过程信息
        item: {
            //父级编码
            id: "0",
            //请求相对地址
            href: "index"
        }
    },
    //fetch 抓取
    grab: function (urlprefix, deep, item) {
        if (item.href == null) {
            return false;
        }
        var url = urlprefix;
        switch (deep) {
            case 4:
                url += item.id.substr(0, 2) + "/";
                break;
            case 5:
                url += item.id.substr(0, 2) + "/" + item.id.substr(2, 2) + "/";
                break;
        }
        url += item.href + ".html";

        zoning.taskcount += 1;

        //fetch 抓取 gb2312
        fetch(url).then(res => res.blob()).then(blob => {
            var reader = new FileReader();
            reader.onload = function () {
                zoning.taskcount -= 1;
                var list = zoning.matcharray(reader.result, item, deep, url);
                zoning.taskdefer[item.id] = setInterval(function () {
                    //终止
                    if (zoning.stop) {
                        clearInterval(zoning.taskdefer[item.id]);
                        return false;
                    }
                    //暂停、任务量限制
                    if (!zoning.pause && zoning.taskcount < 200) {
                        clearInterval(zoning.taskdefer[item.id]);
                        if (list.length > 0 && deep < zoning.config.deepmax) {
                            for (var i = 0; i < list.length; i++) {
                                var li = list[i];
                                deep += 1;
                                zoning.grab(urlprefix, deep, li);
                                deep -= 1;
                            }
                        }
                    }
                }, 10);
            }
            reader.readAsText(blob, 'GBK');
        }).catch(function (e) {
            var obj = {};
            obj.item = item;
            obj.url = url;
            obj.href = item.href;
            obj.deep = deep;
            obj.error = e + "";
            zoning.catchdata.push(obj);
            zoning.taskcount -= 1;
        });
    },
    //异常记录重新抓取
    grabcatch: function (catchdata) {
        for (var i = 0; i < catchdata.length; i++) {
            var cdi = catchdata[i];
            cdi.item.href = cdi.href;
            zoning.grab(zoning.config.urlprefix, cdi.deep, cdi.item);
        }
    },
    //任务延时记录
    taskdefer: {},
    //任务量
    taskcount: 0,
    //抓取数量
    matchcount: 0,
    //抓取异常记录
    catchdata: [],
    //抓取结果数据
    matchdata: {},
    //匹配抓取内容
    matcharray: function (data, item, deep, url) {
        var arr = [];
        //替换单引号为双引号、清除br标签
        data = data.replace(/'/g, '"').replace(/<br\/>/g, "");
        //匹配所有的A标签
        var reg = /<a[^>]*href=['"]([^"]*)['"][^>]*>(.*?)<\/a>/g;
        var matchs = data.match(reg), clen;
        if (matchs && deep > 1) {
            //记录当前id最大长度
            clen = matchs[0].split('.')[0].split('/')[1].length;
        }

        var currid = [];

        //匹配 最后末级无链接 项
        data.replace(/<td>[0-9]{12}<\/td><td>[0-9]{3}<\/td><td>.*?<\/td>/g, function (x) {
            var mat = x.split('</td><td>');
            var obj = {};
            obj.href = null;
            obj.id = mat[0].split('>')[1];
            obj.text = mat[2].split('<')[0];
            arr.push(obj);
            currid.push(obj.id);
        });


        //匹配 市辖区 无链接 项
        data.replace(/<td>[0-9]{12}<\/td><td>.*?<\/td>/g, function (x) {
            var mat = x.split('</td><td>');
            var obj = {};
            obj.href = null;
            obj.id = mat[0].split('>')[1];
            if (clen) {
                obj.id = obj.id.substr(0, clen);
            }
            obj.text = mat[1].split('<')[0];
            if (currid.indexOf(obj.id) == -1) {
                arr.push(obj);
            }
        });

        //有A标签
        if (matchs) {
            for (var i = 0; i < matchs.length; i++) {
                var mat = matchs[i];
                var obj = {};
                obj.href = mat.split('"')[1].split('.')[0];
                //链接href有斜杠/，即链接有层级，只取最后层
                var hpre = mat.split('.')[0];
                if (hpre.indexOf('/') >= 0) {
                    obj.id = hpre.split('/')[1];
                } else {
                    obj.id = hpre.split('"')[1];
                }
                if (deep > 1) {
                    mat = matchs[++i];
                }
                obj.text = mat.split('>')[1].split('<')[0];
                arr.push(obj);
            }
        }

        //得到文件名（编码）
        var filename = item.id || "0";

        zoning.matchdata[filename] = arr;
        //记录请求结果数量
        zoning.matchcount += 1;
        return arr;
    },
    //外部调用生成下载
    zip: function () {
        zoning.ziping(zoning.matchdata, zoning.catchdata);
    },
    //内部调用生成下载
    ziping: function (matchdata, catchdata) {
        zoning.getScript(zoning.config.urljszip, function () {
            zoning.getScript(zoning.config.urlfilesaver, function () {
                var zip = new JSZip();

                var data = {};
                for (var i in matchdata) {
                    var di = matchdata[i];
                    for (var j = 0; j < di.length; j++) {
                        delete di[j].href;
                    }
                    data[i] = di;
                    if (i.length > 1) {
                        zip.file(i.substr(0, 2) + "/" + i + ".json", JSON.stringify(di));
                    }
                    else {
                        zip.file(i + ".json", JSON.stringify(di));
                    }
                }
                zip.file("zoning-" + zoning.config.deepmax + ".json", JSON.stringify(data));
                if (catchdata.length) {
                    zip.file("catch-" + zoning.config.deepmax + ".json", JSON.stringify(catchdata));
                }
                zip.generateAsync({ type: "blob" }).then(function (content) {
                    saveAs(content, "zoning-" + zoning.config.deepmax + ".zip");
                });
            });
        });
    },
    //开始运行
    run: function () {
        zoning.startTime = new Date().valueOf();
        zoning.taskdefer.run = setInterval(function () {
            console.log("count: " + zoning.matchcount + "  taskcount: " + zoning.taskcount);
            if (!zoning.pause && zoning.taskcount == 0) {
                clearInterval(zoning.taskdefer.run);
                zoning.zip();
            }
        }, 1000 * 4);
        console.log('fetching ... please see the network tab');
        zoning.grab(zoning.config.urlprefix, zoning.config.deep, zoning.config.item);
    }
};

//开始运行 可手动调用
zoning.run();

//下载zip，抓取完成后
//zoning.zip();

//修改抓取层级
//deepmax:3 | 4 |5

//任务量
//zoning.taskcount

//抓取数量
//zoning.matchcount

//抓取异常记录
//zoning.catchdata

//抓取结果数据
//zoning.matchdata

/*
 * 注意：
 * 
 * 首次抓取会出现大量失败请求，再次抓取会从浏览器缓存获取，非常快。
 * 
 * 文件：
 * 0.json 根数据
 * 12.json 二级数据
 * 1234.json 三级数据
 * 123456.json 四级数据
 * 123456789.json 五级数据
 * 
 * 其他：
 * zoning-*.json 所有数据，* 代表级数
 * catch-*.json 抓取异常记录（有异常时）
 * 
 * 测试：
 * Chrome比较快，会出现几个链接抓取失败；
 * Firefox比较稳定，抓取有保障，内存占用高（推荐）
 * 
 */
```

> [联系打赏](https://ss.netnr.com/contact)