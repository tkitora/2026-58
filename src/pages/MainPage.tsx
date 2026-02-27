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
            {/* relative を追加して、絶対配置の基準に */}
            <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover overflow-auto">
                <div className="w-2/3 mx-auto mt-10 bg-white/80 backdrop-blur border-b border-gray-200 p-20 relative overflow-hidden">
                    <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-4">
                        <h1 className="text-6xl md:text-7xl font-bold text-center m-auto">
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
                        {/* 左上にチュートリアルボタンを配置 */}
                        <div
                            onClick={handleTutorialClick}
                            className="absolute left-5 top-5 p-3 rounded-xl px-3 py-2 hover:bg-gray-100 active:scale-75 hover:shadow-sm transition"
                        >
                            <p className="text-2xl font-medium text-gray-700 cursor-pointer">
                                🔰 チュートリアル
                            </p>
                        </div>
                    </div>

                    <div className="flex mx-auto max-w-5xl items-center justify-between px-6 py-10">

                        <div className="grid grid-cols-2 gap-6 gap-y-10 w-full max-w-3xl px-6 mt-12 mx-auto text-2xl text-center">

                            <div
                                onClick={handleSingleClick}
                                className="h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transition text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                シングル
                            </div>

                            <div
                                onClick={handleMultiClick}
                                className="h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transition text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                マルチ
                            </div>

                            <div
                                onClick={handleAccClick}
                                className="h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transition text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                アカウント
                            </div>

                            <div
                                onClick={handleShopClick}
                                className="h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transition text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                ショップ
                            </div>

                        </div>

                        {/* チュートリアルの初回確認ダイアログ */}
                        {showTutorialPrompt && (
                            <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
                                <div className="bg-white p-8 rounded-2xl text-center max-w-md w-[90%] shadow-2xl">
                                    <h2 className="text-2xl font-bold mb-4 text-gray-800">
                                        ならげっさーの世界へようこそ！
                                    </h2>
                                    <p className="text-gray-600 mb-8 text-lg">
                                        チュートリアルを行いますか？
                                    </p>
                                    <div className="flex justify-around gap-4">
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
                    </div>
                    <div className="absolute bottom-0 animate-deer-move pointer-events-none select-none">
                        <img src={deer} alt="" className="w-24 animate-deer-sway" />
                    </div>
                </div>
            </div>
        </>
    );
}

export default MainPage;