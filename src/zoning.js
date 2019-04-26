/*
 * https://github.com/netnr/zoning
 * https://gitee.com/netnr/zoning
 * 
 * 2019-04-26
 * netnr
 * 
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

var zoning = {
    //版本号
    version: "2.0.18",
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
    //fetch 抓取
    grab: function (urlprefix, deep, item) {
        if (item.path == null) {
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
        url += item.path + ".html";

        //总数
        zoning.taskcount++;

        //fetch 抓取 gb2312
        fetch(url).then(res => res.blob()).then(blob => {
            var reader = new FileReader();
            reader.onload = function () {
                var list = zoning.matcharray(reader.result, item, deep, url);
                //过滤
                if (zoning.config.fetchcode.length) {
                    var fetchlist = list.filter(x => zoning.config.fetchcode.indexOf(x.id) > -1);
                    if (fetchlist.length) {
                        list = fetchlist;
                    }
                }
                if (list.length > 0 && deep < zoning.config.deepmax) {
                    for (var i = 0; i < list.length; i++) {
                        var li = list[i];
                        zoning.queue.add({
                            urlprefix: urlprefix,
                            deep: deep + 1,
                            item: li
                        });
                    }
                }
            }
            reader.readAsText(blob, 'GBK');
        }).catch(function (e) {
            var obj = {};
            obj.item = item;
            obj.url = url;
            obj.path = item.path;
            obj.deep = deep;
            obj.error = e + "";
            zoning.catchdata.push(obj);
        });
    },
    //异常记录重新抓取
    grabcatch: function (catchdata) {
        for (var i = 0; i < catchdata.length; i++) {
            var cdi = catchdata[i];
            cdi.item.path = cdi.path;
            zoning.grab(zoning.config.urlprefix, cdi.deep, cdi.item);
        }
    },
    //任务队列
    queue: {
        //列表
        list: [],
        //新增
        add: function (task) {
            zoning.queue.list.push(task);
        },
        //消费
        use: function (n) {
            var len = zoning.queue.list.length;
            if (len) {
                return zoning.queue.list.splice(0, Math.min(n || 1, len));
            }
            return null;
        },
        //运行
        run: function () {
            clearInterval(zoning.taskdefer.queuerun);
            zoning.taskdefer.queuerun = setInterval(function () {
                //暂停
                if (!zoning.pause) {
                    var task = zoning.queue.use();
                    if (task) {
                        task.forEach(x => zoning.grab(x.urlprefix, x.deep, x.item));
                    }
                }
            }, zoning.config.gap);
        }
    },
    //任务延时记录
    taskdefer: {},
    //任务总量
    taskcount: 0,
    //抓取数量
    matchcount: 0,
    //抓取异常记录
    catchdata: [],
    //抓取结果数据
    matchdata: {},
    //匹配抓取内容
    matcharray: function (data, item, deep) {
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
            obj.path = null;
            obj.id = mat[0].split('>')[1];
            obj.text = mat[2].split('<')[0];
            arr.push(obj);
            currid.push(obj.id);
        });

        //匹配 市辖区 无链接 项
        data.replace(/<td>[0-9]{12}<\/td><td>.*?<\/td>/g, function (x) {
            var mat = x.split('</td><td>');
            var obj = {};
            obj.path = null;
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
                obj.path = mat.split('"')[1].split('.')[0];
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
                        delete di[j].path;
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
            if (zoning.stop) {
                clearInterval(zoning.taskdefer.run);
                clearInterval(zoning.taskdefer.queuerun);
                zoning.zip();
            } else if (zoning.pause) {

            } else {
                console.log("fetch: " + zoning.matchcount + "  catch: " + zoning.catchdata.length);
            }
        }, 1000 * 3);
        console.log('fetching ... please see the network tab');
        //抓取写入队列
        zoning.grab(zoning.config.urlprefix, zoning.config.deep, zoning.config.item);
        //消费队列
        zoning.queue.run();
    }
};

//任务总量
//zoning.taskcount
//抓取数量
//zoning.matchcount
//抓取异常记录
//zoning.catchdata
//抓取结果数据
//zoning.matchdata

//参数配置
zoning.config = {
    //jszip CDN
    urljszip: "https://lib.baomitu.com/jszip/3.1.4/jszip.min.js",
    //fileSaver CDN
    urlfilesaver: "https://lib.baomitu.com/FileSaver.js/2014-11-29/FileSaver.min.js",
    //抓取首页
    urlprefix: "http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2018/",
    //抓取过程信息
    item: {
        //父级编码
        id: "0",
        //请求相对地址
        path: "index"
    },
    //起始深度
    deep: 1,
    //最大深度, 4 街道 约3380，5 村 约46800
    deepmax: 5,
    //发起时间间隔,单位：毫秒（测试200毫秒稳定）
    gap: 250,
    //抓指定编码，为空时抓所有
    //如 ["11", "50"] 表示只抓北京市、重庆市
    fetchcode: []
};
//开始运行
zoning.run();

//下载zip，抓取完成后
//zoning.zip();

//注意：网站有速率限制，请求过快会出现验证码和锁IP
//      可尝抓取指定编码，修改时间间隔，浏览器缓存后再高速请求
