import { HomePage, MainPage, Single, SingleGame, Account, AuthCallback, Login } from './index';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <>
      <Router>
        <main>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/mainpage' element={<MainPage />} />
            <Route path='/single' element={<Single />} />
            <Route path='/singlegame' element={<SingleGame />} />
            <Route path='/account' element={<Account />} />
            <Route path='/login' element={<Login />} />
            <Route path='/authcallback' element={<AuthCallback />} />
          </Routes>
        </main>
      </Router>
    </>
  )
}
export default App