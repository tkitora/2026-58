import { useNavigate } from 'react-router-dom';

function MainPage() {
    const navigate = useNavigate();

    const handleSingleClick = () => {
        navigate('/Single');
    };
    const handleMultiClick = () => {
        navigate('/Multi');
    };
    const handleAccClick = () => {
        navigate('/Account');
    };


    return(
        <>
            <h1>
                ならげっさータイトル
            </h1>
            <div>
                <p onClick={handleSingleClick}>
                    シングル
                </p>
                <p onClick={handleMultiClick}>
                    マルチ
                </p>
                <p onClick={handleAccClick}>
                    アカウント
                </p>
            </div>
        </>
    );
}


export default MainPage;