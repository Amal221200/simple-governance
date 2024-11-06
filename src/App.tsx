import AddProposalForm from "./components/add-proposal-form"
import Header from "./components/header"
import Proposals from "./components/proposals"

const App = () => {
  return (
    <>
      <Header />
      <div className="h-screen w-full mt-16 px-4 mb-5 py-5">
        <AddProposalForm />
        <Proposals />
      </div>
    </>
  )
}

export default App