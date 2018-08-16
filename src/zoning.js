/*
 * zoning
 * 
 * netnr
 * 2018-08-16
 * 
 * */

var zoning = {
    //版本号
    version: "1.0.0",
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
        deepmax: 4,
        //抓取过程信息
        item: {
            //父级编码
            id: "00",
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
        }
        url += item.href + ".html";
        //fetch 抓取 gb2312
        fetch(url).then(res => res.blob()).then(blob => {
            var reader = new FileReader();
            reader.onload = function () {
                var list = zoning.matcharray(reader.result, item, deep);
                if (list.length > 0 && deep < zoning.config.deepmax) {
                    for (var i = 0; i < list.length; i++) {
                        var li = list[i];
                        deep += 1;
                        zoning.grab(urlprefix, deep, li);
                        deep -= 1;
                    }
                }
            }
            reader.readAsText(blob, 'GBK');
        }).catch(function (e) {
            var obj = {};
            obj.item = item;
            obj.url = url;
            obj.error = e;
            zoning.catchdata.push(obj);
        });
    },
    //抓取数量
    matchcount: 0,
    //记录 matchcount 不变次数，当达到指定次数视为抓取完毕（暂时没想到其他的办法判断抓取是否结束）
    samecount: 0,
    //抓取异常记录
    catchdata: [],
    //抓取结果数据
    matchdata: {},
    //匹配抓取内容
    matcharray: function (data, item, deep) {
        var arr = [];
        //匹配 市辖区 无链接 项
        data.match(/<td>[0-9]{12}<\/td><td>.*?<\/td>/g, function (x) {
            var mat = x.split('</td><td>');
            var obj = {};
            obj.href = null;
            obj.id = mat.split('>')[1];
            obj.text = mat.split('<')[0];
            arr.push(obj);
        });
        data = data.replace(/'/g, '"').replace(/<br\/>/g, "");
        //匹配所有的A标签
        var reg = /<a[^>]*href=['"]([^"]*)['"][^>]*>(.*?)<\/a>/g;
        var matchs = data.match(reg);
        if (!matchs) {
            return [];
        }
        var filename = "00";
        switch (deep) {
            //首页
            case 1:
                for (var i = 0; i < matchs.length; i++) {
                    var mat = matchs[i];
                    var obj = {};
                    obj.id = mat.split('"')[1].split('.')[0];
                    obj.href = obj.id;
                    obj.text = mat.split('>')[1].split('<')[0];
                    arr.push(obj);
                }
                break;
            case 2:
            case 3:
            case 4:
                for (var i = 0; i < matchs.length; i++) {
                    var mat = matchs[i];
                    var obj = {};
                    obj.href = mat.split('"')[1].split('.')[0];
                    obj.id = mat.split('>')[1].split('<')[0];
                    mat = matchs[++i];
                    obj.text = mat.split('>')[1].split('<')[0];
                    arr.push(obj);
                }
                break;
        }
        //根据深度 得到文件名（编码）
        switch (deep) {
            case 2:
                filename = item.id;
                break;
            case 3:
                filename = item.id.substr(0, 4);
                break;
            case 4:
                filename = item.id.substr(0, 6);
                break;
        }
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
                    data[i] = di;
                    for (var j = 0; j < di.length; j++) {
                        delete di[j].href;
                    }
                    zip.file(i + ".json", JSON.stringify(di));
                }
                zip.file("all.json", JSON.stringify(data));
                if (catchdata.length) {
                    zip.file('catch.json', JSON.stringify(catchdata));
                }
                zip.generateAsync({ type: "blob" }).then(function (content) {
                    saveAs(content, "zoning.zip");
                });
            });
        });
    },
    //开始运行
    run: function () {
        zoning.startTime = new Date().valueOf();
        zoning.taskid = setInterval(function () {
            if (zoning._matchcount == null) {
                zoning._matchcount = -1;
            }
            if (zoning._matchcount == zoning.matchcount) {
                zoning.samecount += 1;
            } else {
                zoning.samecount = 0;
            }
            if (zoning.samecount > 10) {
                clearInterval(zoning.taskid);
                zoning.zip();
            }
            zoning._matchcount = zoning.matchcount;
            console.log("count:" + zoning.matchcount);
        }, 1000 * 3);
        console.log('fetching ... please see the network tab');
        zoning.grab(zoning.config.urlprefix, zoning.config.deep, zoning.config.item);
    }
};

//开始运行 可手动调用
zoning.run();

//下载zip，抓取完成后
//zoning.zip();