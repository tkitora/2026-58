import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import deer from "../assets/deer.png";

function MainPage() {
    const navigate = useNavigate();

    // チュートリアル確認ダイアログの表示状態を管理
    const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);

    useEffect(() => {
        // ページを開いた時に、ローカルストレージのフラグを確認
        const isCompleted = localStorage.getItem('tutorialCompleted');
        if (!isCompleted || isCompleted === 'false') {
            setShowTutorialPrompt(true);
        }
    }, []);

    // ダイアログで「やる！」を選んだ時
    const handleTutorialStart = () => {
        setShowTutorialPrompt(false);
        navigate('/tutorial');
    };

    // ダイアログで「だいじょうぶ！」を選んだ時
    const handleTutorialSkip = () => {
        // やらない場合も完了扱いにして、次から出ないように
        localStorage.setItem('tutorialCompleted', 'true');
        setShowTutorialPrompt(false);
    };

    // 左上のボタンから手動でチュートリアルに行く時
    const handleTutorialClick = () => {
        navigate('/tutorial');
    };

    const handleSingleClick = () => {
        navigate('/single');
    };
    const handleMultiClick = () => {
        navigate('/multi');
    };
    const handleAccClick = () => {
        navigate('/account');
    };
    const handleShopClick = () => {
        navigate('/shop');
    };

    return (
        <>
            {/* 背景 */}
            <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-cover px-3 sm:px-6 py-6 sm:py-10">
                {/* メインカード：スマホは横幅いっぱい、PCで最大幅 */}
                <div className="w-full max-w-5xl mx-auto bg-white/80 backdrop-blur border-b border-gray-200 rounded-2xl p-5 sm:p-10 md:p-14 lg:p-20 relative overflow-hidden">
                    {/* Header：スマホは縦並び、sm以上で横並び */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2 sm:px-6 py-4">
                        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-center sm:text-left w-full">
                            {"ならげっさー！".split("").map((char, i) => (
                                <span
                                    key={i}
                                    className="inline-block animate-wave"
                                    style={{ animationDelay: `${i * 0.1}s` }}
                                >
                                    {char}
                                </span>
                            ))}
                        </h1>

                        {/* チュートリアル：スマホでは右上に固定せず、上に並べても押しやすいように */}
                        <button
                            onClick={handleTutorialClick}
                            className="sm:absolute sm:left-5 sm:top-5 self-center sm:self-auto p-3 rounded-xl px-3 py-2 hover:bg-gray-100 active:scale-95 hover:shadow-sm transition"
                        >
                            <p className="text-lg sm:text-2xl font-medium text-gray-700 cursor-pointer">
                                🔰 チュートリアル
                            </p>
                        </button>
                    </div>

                    {/* Menu */}
                    <div className="mx-auto max-w-5xl px-2 sm:px-6 py-6 sm:py-10">
                        {/* スマホ1列 -> sm以上2列 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 gap-y-4 sm:gap-y-10 w-full max-w-3xl mx-auto text-lg sm:text-2xl text-center mt-4 sm:mt-12">
                            <div
                                onClick={handleSingleClick}
                                className="h-14 sm:h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition font-medium text-gray-700 cursor-pointer"
                            >
                                シングル
                            </div>

                            <div
                                onClick={handleMultiClick}
                                className="h-14 sm:h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition font-medium text-gray-700 cursor-pointer"
                            >
                                マルチ
                            </div>

                            <div
                                onClick={handleAccClick}
                                className="h-14 sm:h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition font-medium text-gray-700 cursor-pointer"
                            >
                                アカウント
                            </div>

                            <div
                                onClick={handleShopClick}
                                className="h-14 sm:h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition font-medium text-gray-700 cursor-pointer"
                            >
                                ショップ
                            </div>
                        </div>
                    </div>

                    {/* チュートリアルの初回確認ダイアログ：スマホで溢れないよう padding + max-h + scroll */}
                    {showTutorialPrompt && (
                        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-3 sm:p-6">
                            <div className="bg-white p-6 sm:p-8 rounded-2xl text-center max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-800">
                                    ならげっさーの世界へようこそ！
                                </h2>
                                <p className="text-gray-600 mb-6 sm:mb-8 text-base sm:text-lg">
                                    チュートリアルを行いますか？
                                </p>

                                {/* スマホは縦、sm以上は横 */}
                                <div className="flex flex-col sm:flex-row justify-around gap-3 sm:gap-4">
                                    <button
                                        onClick={handleTutorialStart}
                                        className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors w-full"
                                    >
                                        やる！
                                    </button>
                                    <button
                                        onClick={handleTutorialSkip}
                                        className="px-6 py-3 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-colors w-full"
                                    >
                                        だいじょうぶ！
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 鹿：スマホで見切れないよう少し内側に */}
                    <div className="absolute bottom-0 left-2 sm:left-0 animate-deer-move pointer-events-none select-none">
                        <img src={deer} alt="" className="w-16 sm:w-24 animate-deer-sway" />
                    </div>
                </div>
            </div>
        </>
    );
}

export default MainPage;