export type SearchableClip = {
  body: string;
  title: string;
  vault: string;
  type: string;
  riskLabel: string;
  description: string;
  whenToUse: string;
  before: string;
  risk: string;
};

export const DEV_SEARCH_SYNONYMS: Array<[RegExp, string]> = [
  [
    /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)\b/i,
    "再帰的に削除 再起的に削除 再帰削除 再起削除 削除 remove delete clean build output dist削除",
  ],
  [
    /docker\s+compose\s+down\b.*--volumes/i,
    "volume削除 ボリューム削除 docker停止 コンテナ削除",
  ],
  [/\bgit\s+reset\s+--hard\b/i, "変更破棄 git履歴 作業ツリー reset hard"],
  [/\bgit\s+clean\b/i, "未追跡ファイル削除 clean untracked"],
  [/\bsudo\b/i, "管理者権限 privilege 権限 root"],
  [
    /\bcurl\b.*\|\s*(sh|bash)/i,
    "remote script リモートスクリプト pipe install",
  ],
  [
    /\.env|token|secret|password|id_rsa/i,
    "機密情報 secret token password env 秘密鍵",
  ],
];

export function buildDevSearchText(clip: SearchableClip) {
  const synonyms = DEV_SEARCH_SYNONYMS.filter(([pattern]) =>
    pattern.test(clip.body),
  ).map(([, words]) => words);

  return [
    clip.body,
    clip.title,
    clip.vault,
    clip.type,
    clip.riskLabel,
    clip.description,
    clip.whenToUse,
    clip.before,
    clip.risk,
    ...synonyms,
  ].join(" ");
}
