# 题库系统开发文档

## 一、搜题 API

### 1. 接口描述
该接口用于根据用户输入的问题内容，从本地题库中搜索匹配的题目。

### 2. 请求信息

- **请求方式**：POST
- **请求路径**：`https://tiku.122050.xyz/adapter-service/search?use=local`
- **请求头**：
  - `content-type: application/json`
- **请求体**：
  ```json
  {
    "question": "《国家税务总局关于互联网平台企业为平台内从业人员办理扣缴申报、代办申报若干事项的公告》(国家税务总局公告2025年第16号)中，平台企业需要为哪些人员办理扣缴申报?",
    "type": 0,
    "options": [
      "以上都是",
      "与平台签订劳动合同的从业人员",
      "通过平台提供劳务并取得收入的人员",
      "平台的管理人员"
    ]
  }
  ```

### 3. 响应信息

- **响应示例**：
  ```json
  {
    "plat": 0,
    "question": "违反安全保障义务责任属于（）",
    "options": [
      "公平责任",
      "特殊侵权责任",
      "过错推定责任",
      "连带责任"
    ],
    "type": 1,
    "answer": {
      "answerKey": [
        "B",
        "C"
      ],
      "answerKeyText": "BC",
      "answerIndex": [
        1,
        2
      ],
      "answerText": "特殊侵权责任#过错推定责任",
      "bestAnswer": [
        "特殊侵权责任",
        "过错推定责任"
      ],
      "allAnswer": [
        [
          "特殊侵权责任",
          "过错推定责任"
        ],
        [
          "A特殊侵权责任",
          "B过错推定责任"
        ]
      ]
    }
  }
  ```

## 二、上传题目

### 1. 接口描述
该接口用于批量创建题目到本地题库，需要用户登录认证。

### 2. 请求信息

- **请求方式**：POST
- **请求路径**：`https://tiku.122050.xyz/adapter-service/questions`
- **请求头**：
  - `Authorization: <token>`（登录获取的 token，没有Bearer前缀）
  - `content-type: application/json`
- **请求体**：
  ```json
  [
    {
      "question": "违反安全保障义务责任属于（）",
      "options": "[\"公平责任\",\"特殊侵权责任\",\"过错推定责任\",\"连带责任\"]",
      "answer": "[\"特殊侵权责任\",\"过错推定责任\"]",
      "type": 1,
      "plat": 0,
      "course_name": "法律基础",
      "extra": "第三章"
    }
  ]
  ```

### 3. 字段说明

| 字段名        | 类型              | 必填 | 说明                                                      |
|---------------|-------------------|------|-----------------------------------------------------------|
| `question`    | string            | 是   | 题目内容                                                  |
| `options`     | string (JSON数组) | 否   | 选项列表，JSON 字符串格式                                 |
| `answer`      | string (JSON数组) | 是   | 答案，JSON 字符串格式                                     |
| `type`        | int32             | 是   | 题型：0=单选，1=多选，2=填空，3=判断，4=简答，15=阅读理解 |
| `plat`        | int32             | 否   | 平台标识                                                  |
| `course_name` | string            | 否   | 课程名称                                                  |
| `extra`       | string            | 否   | 额外信息（如章节等）                                      |

### 4. 响应信息

- **成功响应**：
  ```json
  {
    "message": "成功创建2条数据"
  }
  ```

## 三、认证说明

### 1. 获取 Token

- **请求方式**：GET
- **请求路径**：`https://tiku.122050.xyz/adapter-service/user/login?username=<username>&password=<password>`
- **示例**：
  ```bash
  curl -X GET "https://tiku.122050.xyz/adapter-service/user/login?username=admin&password=pw12345"
  ```
- **响应示例**：
  ```json
  {
    "jwt": "xxxxxxxxxxxxxxxxxxxxxx",
    "message": "user login"
  }
  ```
- **说明**：登录成功后，将返回的 `jwt` 作为后续请求的 `Authorization` 头部值。