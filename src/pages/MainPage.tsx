import { useNavigate } from 'react-router-dom';

function MainPage() {
    const navigate = useNavigate();

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


    return(
        <>
            <div
                className="min-h-screen min-w-full bg-[url('/src/assets/bg.png')] bg-no-repeat bg-center bg-auto md:bg-cover"
            >
                <div className="flex justify-center relative p-20">
                    <h1 className="text-white text-7xl font-bold drop-shadow-lg">
                    ならげっさー！
                    </h1>

                    <div className="p-3 bg-gray-700/50 rounded-xl border-2 border-white cursor-pointer absolute right-5">
                        <p className="text-white text-2xl">👤</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6 w-full max-h-max max-w-3xl px-6 mt-30 text-white text-2xl text-center">
                    <p onClick={handleSingleClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4">
                        シングル
                    </p>
                    <p onClick={handleMultiClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4">
                        マルチ
                    </p>
                    <p onClick={handleAccClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4">
                        アカウント
                    </p>
                    <p onClick={handleShopClick} className="h-16 sm:h-20 md:h-24 bg-gray-700/50 rounded-xl border-2 border-white p-4">
                        ショップ
                    </p>
                </div>
            </div>
        </>
    );
}


export default MainPage;