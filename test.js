(function () {
    'use strict';

    var maxWaitTime = 60000; // 最多等待1分钟
    var intervalTime = 2000; // 每2秒检查一次

    var startTime = Date.now();

    var interval = setInterval(function () {
        if (document.querySelector('li.vp-video__control-bar--video-subtitles-select-item:nth-child(2)')) {
            clearInterval(interval); // 停止检测
            document.querySelector('li.vp-video__control-bar--video-subtitles-select-item:nth-child(2)').click();

            setTimeout(function () {
                if (document.querySelector('li.vp-video__control-bar--video-subtitles-select-item:nth-child(2)').classList.contains('is-checked')) {
                    toast("⚡自动打开中文字幕成功😊");
                } else {
                    toast("⚡自动打开中文字幕失败😢");
                }
            }, 1000); // 点击后再等待1秒进行检查

        } else if (Date.now() - startTime > maxWaitTime) {
            clearInterval(interval); // 停止检测
            toast("⚡超时未找到指定的元素😢");
        }
    }, intervalTime);
})();
