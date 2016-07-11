
var $wrap = $(".wrap");
var $menu = $('.keys');
var $content = $('.content');

// 初始化
source.forEach(function(index, id){
    $menu.append(`
        <li class="loading" data-key="dom_${index}">
            ${id}(<span class="count">0</span>)
        </li>
    `);
    
    $content.append(`<ul class="mb-nav" id="dom_${index}"></ul>`);
});


// 导航定位
$(".left-side").click(function(e){
    var li = e.target.tagName == "LI" ? e.target : (e.target.parentNode.tagName == "LI") ? e.target.parentNode : null

    if(li){
        var id = $(li).attr("data-key")
        var $dom = $("#"+id);
        if($dom.length){
            $('html,body').animate({
                scrollTop: $dom.offset().top
            }, 400);
        }
    }
});

// 刷新
$('#refresh').click(function() {
    store.clearAll();
    initData();
});

// 回到顶部
$('#toTop').click(function() {
    $('html,body').animate({
        scrollTop: 0
    }, 400);
});


// 延时 2.5 s
// 避免浪费请求
setTimeout(initData, 1000 * 2.5);

// 页面显示隐藏时刷新
pageVisibility.visibilitychange(function() {
    if (!pageVisibility.hidden) {
        initData();
    }
});



function initData() {
    var promises = [];

    source.forEach(function(index, id){
        var nowSource = this;

        var $menuLi = $menu.find('[data-key="dom_' + index + '"]');
        $menuLi.addClass('loading');

        /**==================================================================
         * 
         * 先进行缓存验证
         * 
         */
        var storeInfo = null;
        var info = null;
        try {
            storeInfo = JSON.parse(store.get(id));
        } catch (e) {}

        // 缓存有效
        if (storeInfo && store.checkValid(id)) {
           updateDOMContent(index, id, storeInfo, this);
           console.log('[', id, '] use cache');
           return;
        }

        // 缓存过期  先清除掉
        store.del(id);
        // 对应数量置为 0
        $menuLi.addClass('loading').find('.count').text(0);

        $('.wrap, .tools').hide();
        $('#loader').show();

        promises[promises.length] = $.get(this.url).then(function(data) {
            data = processData(data);
            info = parseData(data, nowSource);

            // 缓存 10 min
            store.set(id, JSON.stringify(info), 60 * 10);

            // 对比 storeInfo 与info
            // 然后再更新
            // 保证能告诉用户哪些内容是新的
            if (storeInfo && info) {
                // 只要 info 中有未在 storeInfo 中
                // 出现的元素
                // 那么就认为是新内容
                info.forEach(function(item) {
                    var itemIsOld = storeInfo.some(function(sItem) {
                        return sItem.url === item.url && sItem.title === item.title;
                    });

                    if (!itemIsOld) {
                        item._is_new_ = true;
                    }
                });
            }

            updateDOMContent(index, id, info, nowSource);
        });
    });

    // 都完成之后才显示
    $.when(promises).done(function() {
        $('#toTop').trigger('click');
        $('.wrap, .tools').fadeIn(300);
        $('#loader').fadeOut(400);
    });
}

/**
 * 
 * 初步处理返回的字符串
 * 
 * @param  {String} data
 * @return {String}
 * 
 */
function processData(data) {
    data = data.replace(/src=/gim, 'xsrc=')
               .replace(/<img\s*src=/gim, 'xsrc=')
               .replace(/srcset=/gim, 'xsrcset=')
               .replace(/<img/gim, '<input')
               .replace(/\.(jpg|jpeg|webp|png|gif)/gim, '')
               .replace(/<script/gim, '<template')
               .replace(/script>/gim, 'template>')
               .replace(/<link/gim, '<meta')
               .replace(/<input([^>])+results=/gim, '<input')
               .replace(/<body([^>])*>/gim, '<body>')
               .trim();
    return data.substring(
                data.indexOf('<body>') + 6,

                data.lastIndexOf('</body>') > 0
                        ? data.lastIndexOf('</body>')
                        : data.length
    );
}

/**
 * 
 * 根据当前的处理对象和 data 字符串
 * 生成相应的提供渲染的数组
 * 
 * @param  {Object} data
 * @param  {Object} source
 * @return {Array}
 * 
 */
function parseData(data, source) {
    if (typeof source.parse === 'function') {
        return source.parse(data);
    }

    var info = [];
    var div = document.createElement('div');

    div.innerHTML = data;

    var $columns = $(div).find(source.colum);
    var temp = null;

    for (var i = 0, len = $columns.length; i < len && i < (source.max || 10); i++) {

        temp = source.handle.call(source, $columns.eq(i));

        if (temp) {
            if (!/^http/.test(temp.url)) {
                temp.url = (new URL(temp.url, source.url)).href;
            }

            temp.title = temp.title.trim();
            info.push(temp);
        }
    }

    return info;
}


/**
 * 生成内容
 */
function getRenderContent(info, source, id) {

    var titleText = `<a href="${source.url}" target="_blank" class="mb-blog-name">${id}</a>`;
    var linksText = info.reduce(function(prev, curr) {
        return prev + `<li class="mb-item">
            <a href="${curr.url}" target="_blank" class="mb-title">
                ${curr._is_new_ ? '<b>[new]</b>' : ''}
                ${curr.title}
                <span class="blog-time">${curr.time}</span>
            </a>
        </li>`;
    }, '');

    return titleText + linksText;
}

/**
 * 更新 DOM
 */
function updateDOMContent(index, id, info, source) {
    var content = getRenderContent(info, source, id);

    $('#dom_' + index).empty().html(content);

    $menu.find('[data-key="dom_' + index + '"]')
        .removeClass("loading")
        .find(".count")
        .html($("#dom_" + index + " li").length || 0);
};
 