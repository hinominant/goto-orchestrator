#!/usr/bin/env node
'use strict';

/**
 * Claude Code PreToolUse Hook - Tool Risk Classification
 *
 * ツール実行前にリスクレベルを判定し、
 * HIGH/MEDIUM は確認ダイアログを表示、LOW はサイレント通過。
 *
 * Install: ~/.claude/hooks/tool-risk.js
 * Settings: ~/.claude/settings.json の hooks.PreToolUse に登録
 */

const HIGH_RISK_PATTERNS = [
  /rm\s+.*(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)/,
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-[a-zA-Z]*f/,
  /git\s+branch\s+-D/,
  /DROP\s+(TABLE|DATABASE|INDEX)/i,
  /DELETE\s+FROM/i,
  /TRUNCATE\s+TABLE/i,
  /docker\s+(rm|rmi)\s+-f/,
  /kill\s+-9/,
  /chmod\s+777/,
  /mkfs\b/,
  /dd\s+if=/,
  /shutdown/,
  /reboot/,
  />\s*\/dev\/sd/,
];

const MEDIUM_RISK_PATTERNS = [
  /git\s+push/,
  /git\s+commit/,
  /git\s+merge/,
  /git\s+rebase/,
  /git\s+checkout\s+\./,
  /git\s+restore\s+\./,
  /npm\s+publish/,
  /npm\s+install\s+-g/,
  /pip\s+install/,
  /docker\s+(build|run|compose)/,
  /curl\s+.*-X\s*(POST|PUT|DELETE|PATCH)/i,
  /ssh\s/,
  /scp\s/,
  /rsync\s/,
  /brew\s+(install|uninstall)/,
  /apt(-get)?\s+(install|remove)/,
];

const LOW_TOOL_NAMES = new Set([
  'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'TaskList', 'TaskGet',
]);

/**
 * ツール名と入力からリスクレベルを判定する
 * @param {string} toolName - ツール名
 * @param {object} toolInput - ツール入力
 * @returns {{ level: string, reason: string }}
 */
function classifyRisk(toolName, toolInput) {
  // Read-only tools are always LOW
  if (LOW_TOOL_NAMES.has(toolName)) {
    return { level: 'LOW', reason: '' };
  }

  // Bash command classification
  if (toolName === 'Bash' && toolInput.command) {
    const cmd = toolInput.command;

    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          level: 'HIGH',
          reason: '破壊的・不可逆な操作: ' + cmd.substring(0, 80),
        };
      }
    }

    for (const pattern of MEDIUM_RISK_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          level: 'MEDIUM',
          reason: '外部影響・副作用のある操作: ' + cmd.substring(0, 80),
        };
      }
    }

    return { level: 'LOW', reason: '' };
  }

  // Write/Edit tools
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
    return {
      level: 'MEDIUM',
      reason: 'ファイル変更: ' + (toolInput.file_path || toolInput.notebook_path || ''),
    };
  }

  // Default: LOW
  return { level: 'LOW', reason: '' };
}

// Main
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    const { level, reason } = classifyRisk(toolName, toolInput);

    if (level === 'LOW') {
      // Silent pass-through
      process.stdout.write(JSON.stringify({ decision: 'approve' }));
    } else {
      const indicator = level === 'HIGH' ? '🔴' : '🟡';
      process.stdout.write(JSON.stringify({
        decision: 'ask_user',
        reason: indicator + ' ' + level + ' RISK: ' + reason,
      }));
    }
  } catch (_e) {
    // Parse error -> approve to avoid blocking
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
});
