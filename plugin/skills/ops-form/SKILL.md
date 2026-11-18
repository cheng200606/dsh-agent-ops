---
name: ops-form
description: 当你需要一个结构化的少量输入（几个字段、几个选项）而不是一轮问答时，用它发起一张表单卡片。
---

# ops-form：在对话里发一张表单卡片

## 什么时候用

- 你需要 2–5 个结构化输入（选项、路径、名称、日期），一轮问答会打断用户；
- 你想让用户在一个界面里一次填完，而不是收到五条追问。

**不要**用它来：请求审批（审批走宿主的原生审批卡）、发消息（那要升级审批）、或者干脆用一句话问清楚。

## 怎么用

1. 先加载本 skill（宿主要求 propose_action 之前当前轮次里加载过它）。
2. 调 `propose_action`，`action` 填 `ops_form`，`title` 与 `brief` 写清这张表要收什么。
3. `details` 按下面的形状给：

```json
{
  "summary": "一句话说明这张表要收什么",
  "submitLabel": "保存",
  "fields": [
    { "name": "target", "label": "目标文件", "type": "text", "required": true },
    { "name": "mode", "label": "处理方式", "type": "select", "options": ["仅草稿", "直接应用"], "required": true },
    { "name": "note", "label": "备注", "type": "text", "required": false }
  ]
}
```

- `type` 只能是 `text` 或 `select`；`select` 必须给 `options`（至少两个）。
- 字段数 1–8；`name` 用小写字母、数字与连字符。

## 边界

- 每轮只能发一张卡片（宿主的硬限制）。
- 表单只收数据，不执行动作：用户提交后你会收到字段值，由你决定下一步。
