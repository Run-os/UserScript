// 获取文档对象引用
let _d = window.document

// 获取Vue实例的路由对象的afterHooks数组
let routerAfHooks = _d.querySelector('#app').__vue__.$router.afterHooks

// 如果afterHooks数组存在且第一个元素存在
if (routerAfHooks && routerAfHooks[0]) {
    // 保存原始的afterHooks数组的第一个元素引用
    let oldfunc = routerAfHooks[0]
    
    // 替换afterHooks数组的第一个元素为新的函数
    routerAfHooks[0] = (...args) => {
        // 如果路由路径为"/bmExam"
        if (args[0].path == "/bmExam") {
            // 显示提示框，告知用户即将开始自动作答
            ELEMENT.MessageBox.alert("点击确定，三秒后开始自动作答，此脚本不存在任何逆向操作，答案为后端返回且在开发者控制台可以找到对应的JSON数据包。").then(() => {
                // 在三秒后执行自动作答逻辑
                setTimeout(() => {
                    // 获取问题列表的元素集合
                    let qlist = _d.querySelectorAll("#questionListDiv > li > ul > li")
                    // 获取答案数据集合
                    let alist = _d.querySelector("#nav > div > div.pageBox > div.container1_box > div > div").__vue__.$data.examContents
                    // 定义答案索引对应的数字索引
                    let aindex = { "A": 0, "B": 1, "C": 2, "D": 3 }
                    
                    // 遍历问题列表，根据答案数据选择答案
                    qlist.forEach((item, i) => {
                        // 获取当前问题的答案索引
                        let a_index = aindex[alist[i].answer]
                        // 获取当前问题的所有选项
                        let xlist = item.querySelectorAll("label")
                        // 选择答案
                        xlist[a_index].click()
                    });
                }, 3000)
            })
        }
        // 调用原始函数
        return oldfunc.call(this, ...args)
    }
}