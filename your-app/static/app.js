/**
 * Games App JavaScript - 完成版
 * 第8回: セキュリティの基礎 & 総仕上げ
 *
 * 【このファイルの役割】
 *  ブラウザの画面（HTML）と、バックエンド（main.py）の橋渡しをする。
 *
 * 【全体の流れ】
 *  1. ページが開かれる → loadlibrary() でサーバーからGames一覧を取得
 *  2. renderlibrary() が、取得したデータを画面のリストとして描画する
 *  3. ユーザーが「追加・チェック・削除」を操作する
 *     → 対応する関数がサーバーに変更を送る（fetch）
 *     → 最後にもう一度 loadlibrary() して、最新の状態を画面に反映する
 *
 * ※ fetch はサーバーと通信する命令。通信は時間がかかるので、
 *   async / await を使って「結果が返ってくるまで待つ」書き方をしている。
 */

// サーバー側のAPIのアドレス（main.py の @app.get("/library") などに対応）
const API_URL = "/library";



let showingDeleted = false; // 今どちらのリストを見ているか
// ============================================================
// Games操作（CRUD）
// ============================================================

/**
 * Games一覧を取得して表示する
 */
async function loadlibrary() {
  // try ... catch: 通信中にエラーが起きても、アプリが止まらないようにする
  try {
    const url = showingDeleted ? `${API_URL}?deleted=true` : API_URL;
    // サーバーに「一覧をください」とお願いし、返事(response)を待つ
    const response = await fetch(url);

    // response.ok が false = サーバーがエラーを返したとき
    if (!response.ok) {
      const error = await response.json(); // エラー内容を取り出す
      showError(error.detail || "Gameの取得に失敗しました");
      return; // ここで処理を終える
    }

    // 返ってきたデータ(JSON)をJavaScriptの配列に変換する
    const library = await response.json();

    library.sort((a, b) => a.played - b.played);
    

    if (!showingDeleted) {
      renderStats(library); // 通常モードのときだけ統計を更新
    }


    renderlibrary(library); // 画面に描画する
  } catch (error) {
    // そもそもサーバーにつながらなかったときなど
    showError("通信エラーが発生しました");
  }
}

/**
 * 新しいGamesを追加する
 */
async function addGames() {
  // 入力欄の要素を取得し、入力された文字を読み取る（trimで前後の空白を除去）
  const input = document.getElementById("Games-input");
  const title = input.value.trim();

  const genreInput = document.getElementById("Genre-input");
  const genre = genreInput.value.trim();

  // 送信前のチェック（バリデーション）: 空のときは送らずに注意を表示
  if (title === "") {
    showError("Gameのタイトルを入力してください");
    return;
  }

  // 長すぎるときも送らない（サーバー側でも100文字までチェックしている）
  if (title.length > 100) {
    showError("タイトルは100文字以内で入力してください");
    return;
  }

  try {
    // サーバーに「このGamesを追加して」と送る
    const response = await fetch(API_URL, {
      method: "POST", // POST = 新しいデータを作る
      headers: { "Content-Type": "application/json" }, // 中身はJSON形式だと伝える
      body: JSON.stringify({ title: title, genre: genre }), // データをJSON文字列にして送る
    });

    if (!response.ok) {
      const error = await response.json();
      showError(error.detail || "Gameの追加に失敗しました");
      return;
    }

    input.value = ""; // 入力欄を空に戻す
    genreInput.value = "";
    await loadlibrary(); // 一覧を取り直して、追加結果を画面に反映する
  } catch (error) {
    showError("通信エラーが発生しました");
  }
}

/**
 * Gamesの完了状態を切り替える
 * id: 対象のGamesの番号 / currentplayed: いまの完了状態(true/false)
 */
async function toggleGames(id, currentplayed) {
  try {
    // `${API_URL}/${id}` で /library/5 のようなアドレスを作る（id=5のGamesが対象）
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT", // PUT = 既存のデータを更新する
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ played: !currentplayed }), // !で完了/未完了を反転させる
    });

    if (!response.ok) {
      const error = await response.json();
      showError(error.detail || "Gameの更新に失敗しました");
      return;
    }

    await loadlibrary(); // 一覧を取り直して、更新結果を画面に反映する
  } catch (error) {
    showError("通信エラーが発生しました");
  }
}

/**
 * Gamesを削除する
 * id: 削除したいGamesの番号
 */
async function deleteGames(id) {
  try {
    // /library/5 のようなアドレスに対して削除を依頼する
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE", // DELETE = データを削除する
    });

    if (!response.ok) {
      const error = await response.json();
      showError(error.detail || "Gameの削除に失敗しました");
      return;
    }

    await loadlibrary(); // 一覧を取り直して、削除結果を画面に反映する
  } catch (error) {
    showError("通信エラーが発生しました");
  }
}

async function restoreGame(id) {
  try {
    const response = await fetch(`${API_URL}/${id}/restore`, {
      method: "PUT",
    });

    if (!response.ok) {
      const error = await response.json();
      showError(error.detail || "復元に失敗しました");
      return;
    }

    await loadlibrary();
  } catch (error) {
    showError("通信エラーが発生しました");
  }
}

async function permanentlyDeleteGame(id) {
  const confirmed = confirm("本当に完全に削除しますか？この操作は元に戻せません。");
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_URL}/${id}/permanent`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      showError(error.detail || "完全削除に失敗しました");
      return;
    }

    await loadlibrary();
  } catch (error) {
    showError("通信エラーが発生しました");
  }
}
// ============================================================
// 描画
// ============================================================

/**
 * Gamesリストを描画する（XSS対策: createElement + textContent）
 *
 * 受け取ったGamesの配列をもとに、画面に並べる<li>を1件ずつ組み立てる。
 *
 * 【XSS対策のポイント】
 *  innerHTML に文字列を直接入れると、入力に紛れ込んだ<script>などが
 *  実行されてしまう危険がある（XSS）。そこで textContent を使い、
 *  入力を「ただの文字」として扱うことで、この攻撃を防いでいる。
 */

function renderStats(library) {
  const total = library.length;
  const played = library.filter((Games) => Games.played).length;
  const unplayed = total - played;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-played").textContent = played;
  document.getElementById("stat-unplayed").textContent = unplayed;
}

function renderlibrary(library) {
  const list = document.getElementById("Games-list");
  list.innerHTML = ""; // 古い表示を一度すべて消してから描き直す

  // library配列の1件ずつ(Games)について、リストの行を作る
  library.forEach((Games) => {
    // <li> 完了済みなら "played" クラスを足して見た目を変える
    
    const li = document.createElement("li");
    li.className = "Games-item" + (Games.played ? " played" : "");

    // チェックボックスとタイトルをまとめる<label>
    const label = document.createElement("label");
    label.className = "Games-label";

    // 完了チェックボックス
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "Games-checkbox";
    checkbox.checked = Games.played;
    checkbox.disabled = showingDeleted;
    checkbox.addEventListener("change", () => toggleGames(Games.id, Games.played));

    // Gamesのタイトル文字。textContent で安全に入れる（XSS対策）
    const titleSpan = document.createElement("span");
    titleSpan.className = "Games-title";
    titleSpan.textContent = Games.title;

    const genreSpan = document.createElement("span");
    genreSpan.className = "Games-genre";
    genreSpan.textContent = Games.genre ? `[${Games.genre}]` : "";

    // label の中に [チェックボックス][タイトル] を入れる
   // label の中に [チェックボックス][タイトル][ジャンル] を入れる
    label.appendChild(checkbox);
    label.appendChild(titleSpan);
    label.appendChild(genreSpan);

    // <li> の中にまず label を入れる
    li.appendChild(label);

    if (showingDeleted) {
      // 削除済みモード: 「復元」と「完全削除」ボタンを出す
      const restoreBtn = document.createElement("button");
      restoreBtn.className = "restore-button";
      restoreBtn.textContent = "復元";
      restoreBtn.addEventListener("click", () => restoreGame(Games.id));

      const permanentDeleteBtn = document.createElement("button");
      permanentDeleteBtn.className = "delete-button";
      permanentDeleteBtn.textContent = "完全削除";
      permanentDeleteBtn.addEventListener("click", () => permanentlyDeleteGame(Games.id));

      li.appendChild(restoreBtn);
      li.appendChild(permanentDeleteBtn);
    } else {
      // 通常モード: 今まで通り「削除」ボタン
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-button";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => deleteGames(Games.id));

      li.appendChild(deleteBtn);
    }

    list.appendChild(li);
  });
}
 

// ============================================================
// メッセージ表示
// ============================================================

// エラーメッセージを画面に表示する（5秒後に自動で消える）
function showError(message) {
  const errorDiv = document.getElementById("error-message");
  errorDiv.textContent = message; // メッセージを表示
  errorDiv.style.display = "block"; // 見えるようにする
  // setTimeout: 指定したミリ秒後に処理を実行する。5000ミリ秒 = 5秒
  setTimeout(() => {
    errorDiv.style.display = "none"; // 5秒後に隠す
  }, 5000);
}

// ============================================================
// イベントリスナー
// ============================================================

// フォームが送信された（追加ボタン or Enter）ときの動き
document.getElementById("Games-form").addEventListener("submit", function (e) {
  e.preventDefault(); // ページが再読み込みされる標準動作を止める
  addGames(); // 自分で用意した追加処理を呼ぶ
});

document.getElementById("show-active-btn").addEventListener("click", () => {
  showingDeleted = false;
  document.getElementById("show-active-btn").classList.add("active");
  document.getElementById("show-deleted-btn").classList.remove("active");
  loadlibrary();
});

document.getElementById("show-deleted-btn").addEventListener("click", () => {
  showingDeleted = true;
  document.getElementById("show-deleted-btn").classList.add("active");
  document.getElementById("show-active-btn").classList.remove("active");
  loadlibrary();
});


// ページ読み込み時に、まずGames一覧を取得して表示する（ここがスタート地点）
loadlibrary();
