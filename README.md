# zoning
中华人民共和国行政区划：省级、地级、县级、乡级和村级

> Demo： <https://ss.netnr.com/zoning>  
> Gitee： <https://gitee.com/netnr/zoning>  
> GitHub： <https://github.com/netnr/zoning>

### [变更日志](CHANGELOG.md)

### 来源

- **国家统计局 - 统计用区划和城乡划分代码** 
- <http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/>
* 统计数据截止2020-06-30 于 2020-11-06发布
* <http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2020>

### 使用
- 打开页面 <http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm>
- 打开浏览器控制台（推荐Chrome、Firefox，请不要用IE系列，谢谢）
- 拷贝脚本`zoning.js`的内容粘贴到控制台运行
- 首次抓取会出现大量失败请求，再次抓取会从浏览器缓存获取，非常快
- Chrome比较快，会出现几个链接抓取失败
- Firefox比较稳定，抓取有保障，内存占用高（推荐，测试版本：61.0.2 64-bit）  
-  
- `build.html`用于导出的`JSON`文件生成`SQLite`和`CSV`
- `CSV`导出编码为`utf-8`，Excel打开中文会乱码，需要转换编码为`ANSI` 或 `指定BOM`
- 
- [爬取截图1](https://s1.zme.ink/2019/04/26/1345312e2a.jpg) 、[爬取截图2](https://s1.zme.ink/2019/04/26/1345311bca.jpg)、[爬取截图3](https://s1.zme.ink/2019/04/26/134531735a.jpg)

### 发布
- 支持的格式有：`JSON`文件、`SQLite`数据库、`CSV`文件、`SQL`脚本
- `zoning-*.json`所有数据， `zoning-*.db`SQLite数据库， `zoning-*.csv`CSV文件，`zoning-*.sql`SQL脚本
- `dist/zoning-5` 五级
- `dist/zoning-4` 四级
- `dist/zoning-3` 三级
- npm，`npm install zoningjs`，<https://unpkg.com/zoningjs/>

> [联系打赏](https://zme.ink)