import { useNavigate } from 'react-router-dom';

function Single() {
    const navigate = useNavigate();
    const handleStartClick = () => {
        navigate('/SingleGame')
    };
    const handleRankingClick = () => {
        navigate('/SingleGame_rank')
    };
    return(
        <>
            <div>
                <h1>
                    最近のランキング
                </h1>
            </div>
            <p onClick={handleStartClick}>
                スタート
            </p>
            <p onClick={handleRankingClick}>
                ランキングに挑戦
            </p>
        </>
    );
}


export default Single;