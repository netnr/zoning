# zoning
中华人民共和国行政区划：省级、地级、县级、乡级和村级

> Demo： <https://ss.netnr.com/zoning>

### [变更日志](CHANGELOG.md)

统计用区划和城乡划分代码  
<http://www.stats.gov.cn/sj/tjbz/qhdm/>  

统计数据截止 2023-06-30 于 2023-09-11 发布  
<http://www.stats.gov.cn/sj/tjbz/tjyqhdmhcxhfdm/2023/>

共 5 级

**0.json** 深度 1、2、3  
**1101.json** 深度 4、5  
**6590.json** 深度 4、5  

**stats-zoning-3.json** 爬虫三级总数据 就是 **0.json**  
**stats-zoning-4.json** 爬虫四级总数据  
**stats-zoning-5.json** 爬虫五级总数据  

```
npm install zoningjs
```

列信息

字段 | 类型 | 说明
---- | ---- | ----
id | string | 区划代码，唯一
txt | string | 名称
pid | string | 父级区划代码
sid | string | 简短区划代码，唯一
spid | string | 简短父级区划代码
ct | string | 城乡分类代码
num | int | 同级排序
leaf | int | 是叶节点（1：是；2：否）
deep | int | 爬取深度

爬取源码 (路径可能会失效，但源码始终在该账号的某个项目中)  
https://github.com/netnr/np/tree/main/src/Netnr.P/Netnr.ClientApp/ClientSpider

[联系打赏](https://zme.ink)
