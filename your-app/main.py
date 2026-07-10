"""
gameアプリ バックエンド - 完成版
第8回: セキュリティの基礎 & 総仕上げ
"""

import sqlite3  # Python標準のデータベース（SQLite）を使うためのライブラリ
import uvicorn  # FastAPIアプリを動かすためのWebサーバー

from fastapi import FastAPI, HTTPException  # Webアプリ本体とエラー応答用
from fastapi.middleware.cors import CORSMiddleware  # ブラウザからのアクセスを許可する設定
from fastapi.staticfiles import StaticFiles  # HTML/CSS/JSなどのファイルを配信する機能
from pydantic import BaseModel, Field  # 受け取るデータの形をチェックする道具

# --- FastAPIアプリ ---
# このappが、Webアプリ全体の本体になる
app = FastAPI(title="game library")

# CORS設定: 別のアドレスで動くフロント（ブラウザの画面）からの通信を許可する
# allow_origins=["*"] は「どこからのアクセスでもOK」という意味（学習用の設定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- データベース設定 ---
# データを保存するファイルの名前。アプリと同じフォルダに game.db が作られる
DATABASE = "library.db"


def init_db():
    """データベースとテーブルを初期化する"""
    conn = sqlite3.connect(DATABASE)  # データベースに接続する
    cursor = conn.cursor()  # SQLを実行する係（カーソル）を用意する
    # library テーブルがまだ無ければ作る（IF NOT EXISTS）
    #   id    : 自動で増える番号（主キー）
    #   title : gameの内容（空はNG）
    #   played  : 完了したかどうか（0=未完了, 1=完了）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            genre TEXT DEFAULT '',
            played INTEGER DEFAULT 0
        )
    """)
    conn.commit()  # 変更を確定して保存する
    conn.close()  # 接続を閉じる


# --- Pydanticモデル ---
# APIが受け取るデータの「形」を決めるクラス。
# 形に合わないデータが送られてきたら、FastAPIが自動でエラーを返してくれる。


class GamesCreate(BaseModel):
    # 新しいgameを作るときに受け取るデータ
    # title は1文字以上100文字以下の文字列でなければならない
    title: str = Field(min_length=1, max_length=100)
    genre: str = Field(default="", max_length=50)


class GamesUpdate(BaseModel):
    # gameを更新するときに受け取るデータ
    # played は True / False（完了したかどうか）
    played: bool


# --- APIエンドポイント ---
# @app.get / @app.post などの飾り（デコレータ）で、
# 「どのURLに、どの種類のリクエストが来たら、この関数を動かすか」を決める。


@app.get("/library")  # GET /library にアクセスされたら実行
def get_library():
    """game一覧を取得する"""
    conn = sqlite3.connect(DATABASE)  # 接続する
    cursor = conn.cursor()

    # library テーブルの全データを id 順に取り出す
    cursor.execute("SELECT id, title, genre, played FROM library ORDER BY id")
    library = cursor.fetchall()  # 取り出した全行をリストで受け取る

    conn.close()  # 接続を閉じる
    # 1行は (id, title, played) の順のタプルなので、番号で取り出す。
    # 取り出したデータを、ブラウザに返しやすい辞書のリストに作り変える。
    return [
        {"id": game[0], "title": game[1], "genre": game[2], "played": bool(game[3])}
        for game in library
    ]


@app.post("/library", status_code=201)  # POST /library で新規作成（201=作成成功）
def create_game(game: GamesCreate):
    """新しいgameを作成する"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # 新しいgameを1件追加する（played は 0=未完了で登録）
    # ? を使うことで、危険な文字列が混ざってもSQLが壊れない（SQLインジェクション対策）
    cursor.execute(
        "INSERT INTO library (title, genre, played) VALUES (?, ?, 0)",
        (game.title, game.genre),
    )
    conn.commit()  # 追加を確定する
    game_id = cursor.lastrowid  # たった今追加した行の id を取得する

    conn.close()
    return {"id": game_id, "title": game.title, "genre": game.genre, "played": False}


# PUT /library/5 のように、URLの {game_id} の部分が引数 game_id に入る
@app.put("/library/{game_id}")
def update_game(game_id: int, game: GamesUpdate):
    """gameの完了状態を更新する"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # まず、その id のgameが本当にあるか確認する
    cursor.execute("SELECT title FROM library WHERE id = ?", (game_id,))
    existing = cursor.fetchone()  # 1件だけ取り出す。無ければ None が返る
    if existing is None:
        conn.close()  # 見つからないときも接続は閉じてから終わる
        # 404エラー（見つからない）を返して処理を中断する
        raise HTTPException(status_code=404, detail="game not found")

    # played（完了状態）を更新する。True/False は int() で 1/0 に変換して保存
    cursor.execute(
        "UPDATE library SET played = ? WHERE id = ?",
        (int(game.played), game_id),
    )
    conn.commit()  # 更新を確定する

    conn.close()
    # existing は (title,) のタプルなので、先頭を取り出す
    return {"id": game_id, "title": existing[0], "played": game.played}


@app.delete("/library/{game_id}")  # DELETE /library/5 で id=5 のgameを削除
def delete_game(game_id: int):
    """gameを削除する"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # 削除する前に、その id のgameが存在するか確認する
    cursor.execute("SELECT id FROM library WHERE id = ?", (game_id,))
    existing = cursor.fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="game not found")

    cursor.execute("DELETE FROM library WHERE id = ?", (game_id,))  # 削除する
    conn.commit()  # 削除を確定する

    conn.close()
    return {"message": "game deleted", "id": game_id}


# --- 静的ファイル配信 ---
# static フォルダの中身（index.html など）をそのままブラウザに表示できるようにする
app.mount("/", StaticFiles(directory="static", html=True), name="static")

# --- アプリ起動時にDBを初期化 ---
# プログラムが読み込まれたタイミングで、テーブルが無ければ作っておく
init_db()

# このファイルを直接 `python main.py` で実行したときだけ、サーバーを起動する
if __name__ == "__main__":
    # host="0.0.0.0" で外部からのアクセスも受け付ける。ポート8000で待ち受ける
    uvicorn.run(app, host="0.0.0.0", port=8000)
