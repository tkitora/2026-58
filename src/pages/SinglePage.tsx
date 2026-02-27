import { useNavigate } from 'react-router-dom';

function Single() {
    const navigate = useNavigate();
    const handleStartClick = () => {
        navigate('/singlegame')
    };
    const handleRankingClick = () => {
        navigate('/SingleGame_rank')
    };
    const handleSingleRankClick = () => {
        navigate('/SingleRank')
    }
    return(
        <>
            <p onClick={handleSingleRankClick}>
                ランキング
            </p>
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