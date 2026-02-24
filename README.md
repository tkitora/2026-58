# ならげっさー！
for dev
## gitの使い方忘備録
**コピーのやり方**
上にある<>Codeからurlをコピー
```bash
git clone url
```
今見てたフォルダにフォルダが出来るので改めて開きなおす
**編集の仕方**
```bash
git branch
```
今mainにいる事を確認
もしいなければ
```bash
git checkout main
```
mainからブランチを切って移動
```bash
git checkout -b "feature/なんとか"
```
編集する
**プルリクを送りたい**
最後にmainに戻るのを忘れないように
```bash
git add .
git commit -m "[add]コミットメッセージ"
git push origin "feature/なんとか"
git checkout mian
```
## フォルダ内説明
apikey環境変数は.env
vite-env.d.tsは.jpg.pngをimportするため