import { useNavigate } from 'react-router-dom';

function Single() {
    const navigate = useNavigate();

    // MainPageへの戻るボタン
    const handleBackClick = () => {
        navigate('/mainpage');
    };

    const handleStartClick = () => {
        navigate('/singlegame');
    };
    
    const handleRankingClick = () => {
        navigate('/singlegame_rank');
    };
    
    const handleSingleRankClick = () => {
        navigate('/singlerank');
    };

    return(
        <>
            <div className="min-h-screen min-w-full bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover relative">
                
                <div 
                    onClick={handleBackClick}
                    className="absolute left-5 top-5 p-3 bg-gray-700/50 rounded-xl border-2 border-white cursor-pointer z-10 hover:bg-gray-600/50 transition"
                >
                    <p className="text-white text-xl font-bold">⬅ 戻る</p>
                </div>

                {/* MainPageと同じタイトルロゴと右上のアイコン */}
                <div className="flex justify-center relative p-5">
                    <h1 className="text-white text-7xl font-bold drop-shadow-lg">
                    ならげっさー！
                    </h1>

                    <div className="p-3 bg-gray-700/50 rounded-xl border-2 border-white cursor-pointer absolute right-5 hover:bg-gray-600/50 transition">
                        <p className="text-white text-2xl">👤</p>
                    </div>
                </div>
                
                {/* ボタンのレイアウトエリア。
                  上段は grid-cols-2 で2つ並べ、下段は flex で中央配置。
                */}
                <div className="flex flex-col items-center gap-6 w-full max-w-3xl px-6 mt-30 text-white text-2xl text-center mx-auto">
                    
                    {/* 上段：通常プレイ / ランキングに挑戦 */}
                    <div className="grid grid-cols-2 gap-6 w-full">
                        <p 
                            onClick={handleStartClick} 
                            className="flex items-center justify-center h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition"
                        >
                            通常プレイ
                        </p>
                        <p 
                            onClick={handleRankingClick} 
                            className="flex items-center justify-center h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition"
                        >
                            ランキングに挑戦
                        </p>
                    </div>

                    {/* 下段：ランキング（幅は上段のボタン1つ分） */}
                    <div className="w-full flex justify-center mt-4">
                        <p 
                            onClick={handleSingleRankClick} 
                            className="flex items-center justify-center w-1/2 h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4 cursor-pointer hover:bg-gray-600/50 transition"
                        >
                            ランキング
                        </p>
                    </div>

                </div>

            </div>
        </>
    );
}

export default Single;