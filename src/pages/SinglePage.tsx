import { useNavigate } from 'react-router-dom';
import { Header } from '../index';

function Single() {
    const navigate = useNavigate();


    const handleStartClick = () => {
        navigate('/singlegame');
    };

    const handleRankingClick = () => {
        navigate('/singlegame_rank');
    };

    const handleSingleRankClick = () => {
        navigate('/singlerank');
    };

    return (
        <div className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-cover px-3 sm:px-6 py-6">
            {/* ★共通幅コンテナ：ここが基準 */}
            <div className="w-full max-w-4xl mx-auto">
                <Header backTo="/mainpage" />

                <div className="bg-white/80 backdrop-blur border-b border-gray-200 rounded-2xl p-5 sm:p-10 md:p-14 lg:p-20">
                    <div className="flex items-center justify-center py-4">
                        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-center">
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
                    </div>

                    <div className="flex flex-col items-center w-full max-w-3xl px-0 sm:px-6 mt-6 sm:mt-12 mx-auto text-lg sm:text-2xl text-center">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full">
                            <div
                                onClick={handleStartClick}
                                className="h-14 sm:h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition text-base sm:text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                通常プレイ
                            </div>

                            <div
                                onClick={handleRankingClick}
                                className="h-14 sm:h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition text-base sm:text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                ランキングに挑戦
                            </div>
                        </div>

                        <div className="w-full flex justify-center mt-4 sm:mt-6">
                            <div
                                onClick={handleSingleRankClick}
                                className="h-14 sm:h-20 w-full sm:w-1/2 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-95 hover:shadow-sm transition text-base sm:text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                ランキング
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Single;