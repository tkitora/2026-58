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
        <>
            <div style={{ padding: 24 }} className="min-h-screen bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover">
                <Header backTo="/mainpage"></Header>
                <div className="w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 p-20">
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
                    </div>
                    <div className="flex flex-col items-center w-full max-w-3xl px-6 mt-12 mx-auto text-2xl text-center">
                        {/* 上段：2つ */}
                        <div className="grid grid-cols-2 gap-6 w-full">
                            <div
                                onClick={handleStartClick}
                                className="h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transition text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                通常プレイ
                            </div>

                            <div
                                onClick={handleRankingClick}
                                className="h-20 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transition text-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                ランキングに挑戦
                            </div>
                        </div>

                        {/* 下段：上段ボタン1個分の幅 */}
                        <div className="w-full flex justify-center mt-6">
                            <div
                                onClick={handleSingleRankClick}
                                className="h-20 w-1/2 flex items-center justify-center rounded-xl border-2 border-gray-600 px-3 py-2 bg-gray-100 hover:text-white hover:bg-gray-600/50 active:scale-75 hover:shadow-sm transitiontext-2xl font-medium text-gray-700 cursor-pointer"
                            >
                                ランキング
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}

export default Single;