import { useNavigate } from "react-router-dom";
import React from "react";

type HeaderProps = {
    backTo?: string;
}
const Header: React.FC<HeaderProps> = ({ backTo }) => {
    const navigate = useNavigate();

    const handleBack = () => {
        if (backTo) {
        navigate(backTo);
        } else {
        navigate(-1); // 未指定なら1つ前に戻る
        }
    };
    return (
        <div className="sticky top-0 z-10 w-2/3 mx-auto bg-white/80 backdrop-blur border-b border-gray-200 ">
            <div className="mx-auto max-w-5xl px-6 py-4">
                <button
                className="rounded-xl px-3 py-2 text-2xl font-medium text-gray-700 hover:bg-gray-100 active:scale-75 hover:shadow-sm transition"
                onClick={handleBack}
                >
                ＜ 戻る
                </button>
            </div>
        </div>
    );
}
export default Header;