# Tool Risk Protocol

ツール実行前のリスク分類と説明表示。Claude Code Hooks (PreToolUse) による初心者向け安全ネット。

---

## Risk Levels

| Level | Indicator | Description | Action |
|-------|-----------|-------------|--------|
| HIGH | RED | 破壊的・不可逆な操作 | 確認ダイアログ + 説明表示 |
| MEDIUM | YELLOW | 外部影響・副作用のある操作 | 説明表示 |
| LOW | GREEN | 読み取り専用・ローカル変更 | サイレント通過 |

---

## Risk Classification

### Bash Commands

| Risk | Commands |
|------|----------|
| HIGH | `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `DELETE FROM`, `docker rm -f`, `kill -9`, `chmod 777`, `mkfs`, `dd`, `shutdown` |
| MEDIUM | `git push`, `git commit`, `npm publish`, `docker build`, `pip install`, `curl -X POST/PUT/DELETE`, `ssh`, `scp` |
| LOW | `ls`, `cat`, `grep`, `git status`, `git log`, `git diff`, `npm test`, `echo`, `pwd`, `which` |

### Tools

| Risk | Tools |
|------|-------|
| HIGH | - |
| MEDIUM | Write, Edit, NotebookEdit, Bash (see above) |
| LOW | Read, Glob, Grep, WebFetch, WebSearch |

---

## Hooks Implementation

### PreToolUse Hook

Claude Code の `settings.json` に以下を追加:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/tool-risk.js"
          }
        ]
      }
    ]
  }
}
```

### Hook Script

`~/.claude/hooks/tool-risk.js` に配置。stdin から JSON を受け取り、リスク判定結果を stdout に返す。

```
stdin: { tool_name, tool_input }
  |
Risk Classification
  |
stdout: { decision, reason }
  - LOW: { decision: "approve" }（サイレント通過）
  - MEDIUM/HIGH: { decision: "ask_user", reason: "HIGH RISK: ..." }
```

---

## Use Cases

### 初心者オンボーディング

新しいチームメンバーが Claude Code を使い始める際に、危険な操作を事前に警告する。

```yaml
Scenario: 初めてのClaude Code利用
  1. install.sh --with-hooks でフック設定を自動インストール
  2. LOW risk → サイレント通過（ストレスなし）
  3. MEDIUM risk → 「このコマンドは外部に影響があります」と表示
  4. HIGH risk → 「破壊的操作です。本当に実行しますか？」と表示
```

### 経験者向け

熟練ユーザーは Hook を無効化するか、HIGH のみ表示に変更可能。

```json
{
  "hooks": {
    "PreToolUse": []
  }
}
```

---

## Integration with Guardrails

| Tool Risk | Guardrail Level |
|-----------|-----------------|
| HIGH | L3-L4（破壊的操作は即時確認） |
| MEDIUM | L1-L2（ログ + 軽い警告） |
| LOW | なし |

---

## Template: tool-risk.js

`_templates/hooks/tool-risk.js` にテンプレートを配置。
install.sh --with-hooks で `~/.claude/hooks/` にコピーされる。
