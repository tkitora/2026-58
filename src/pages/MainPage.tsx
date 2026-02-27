import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
        navigate('/tutorial'); // ※ 
    };

    // ダイアログで「だいじょうぶ！」を選んだ時
    const handleTutorialSkip = () => {
        // やらない場合も完了扱いにして、次から出ないように
        localStorage.setItem('tutorialCompleted', 'true');
        setShowTutorialPrompt(false);
    };

    // 左上のボタンから手動でチュートリアルに行く時
    const handleTutorialClick = () => {
        navigate('/Tutorial');
    };

    const handleSingleClick = () => {
        navigate('/Single');
    };
    const handleMultiClick = () => {
        navigate('/Multi');
    };
    const handleAccClick = () => {
        navigate('/Account');
    };
    const handleShopClick = () => {
        navigate('/Shop');
    };

    return(
        <>
            {/* relative を追加して、絶対配置の基準に */}
            <div className="min-h-screen min-w-full bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover relative">
                
                {/* 左上にチュートリアルボタンを配置 */}
                <div 
                    onClick={handleTutorialClick}
                    className="absolute left-5 top-5 p-3 bg-gray-700/50 rounded-xl border-2 border-white cursor-pointer z-10 hover:bg-gray-600/50 transition"
                >
                    <p className="text-white text-xl font-bold">🔰 チュートリアル</p>
                </div>

                <div className="flex justify-center relative p-5">
                    <h1 className="text-white text-7xl font-bold drop-shadow-lg">
                    ならげっさー！
                    </h1>

                    <div className="p-3 bg-gray-700/50 rounded-xl border-2 border-white cursor-pointer absolute right-5 hover:bg-gray-600/50 transition">
                        <p className="text-white text-2xl">👤</p>
                    </div>
                </div>
                
                {/* メニュー部分（少し押しやすいように cursor-pointer を追加） */}
                <div className="grid grid-cols-2 gap-6 w-full max-h-max max-w-3xl px-6 mt-30 text-white text-2xl text-center mx-auto">
                    <p onClick={handleSingleClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition">
                        シングル
                    </p>
                    <p onClick={handleMultiClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition">
                        マルチ
                    </p>
                    <p onClick={handleAccClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition">
                        アカウント
                    </p>
                    <p onClick={handleShopClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition">
                        ショップ
                    </p>
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
        </>
    );
}

export default MainPage;