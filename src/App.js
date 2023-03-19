import { useState, useEffect } from "react";
import { NFTStorage, File } from "nft.storage";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import axios from "axios";

//axios to make api call

// Components
import Spinner from "react-bootstrap/Spinner";
import Navigation from "./components/Navigation";

// ABIs
import NFT from "./abis/NFT.json";

// Config
import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [name, setName] = useState(""); //name is the name for the nft
  const [description, setDescription] = useState(""); //description  is the prompt for ai to generate image
  const [img, setImg] = useState(null); //image from AI Model

  const [url, setUrl] = useState(null); //ipfs stored url

  const [nft, setNft] = useState(null); //storing the contract instance

  const [isWaiting, setIsWaiting] = useState(false);

  const [message, setMessage] = useState("");

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);

    const network = await provider.getNetwork();
    console.log(network);
    const networkID = config[network.chainId];

    console.log(networkID);
    const address = config[network.chainId].nft.address;

    console.log(address);
    //connecting to smart contract -address where it is deployed - abi file - provider from wallet
    const nft = new ethers.Contract(address, NFT, provider);

    setNft(nft);

    const name = await nft.name();

    console.log("name", name);
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (name === "" || description === "") {
      window.alert("Please provide a valid name and description");
      return;
    }

    setIsWaiting(true);
    console.log("submitting......", name, description);

    //calling AI API to generate a image based on description
    const imageData = createImage();

    // upload image to IPFS using NFT.Storage
    const url = await uploadImage(imageData);

    console.log("url", url);

    await mintImage(url);

    console.log("sucessfully minted ");

    setIsWaiting(false);
    setMessage("");
    setName("");
    setDescription("");
  };

  const createImage = async () => {
    setMessage("generating image");

    const API_URL =
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2";
    const api_key = "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";

    //sending the api resquest
    const response = await axios({
      url: API_URL,
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.REACT_APP_HUGGING_FACE_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        inputs: description,
        options: { wait_for_model: true },
      }),
      responseType: "arraybuffer",
    });

    const type = response.headers["content-type"];

    const data = response.data;

    const base64data = Buffer.from(data).toString("base64");

    const img = `data:${type};base64,` + base64data; // this is so we can render it on the screen

    setImg(img);
    return data;
  };

  const uploadImage = async (imageData) => {
    setMessage("Uploading image......");

    //create a instance to NFT.Storage
    const nftstorage = new NFTStorage({
      token: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    });

    // Send request to store image

    const { ipnft } = await nftstorage.store({
      image: new File([imageData], "image.jpeg", { type: "image/jpeg" }),
      name: name,
      description: description,
    });

    // Save the URL

    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`;

    setUrl(url);

    return url;
  };

  const mintImage = async (tokenURI) => {
    setMessage("Waiting for Minting .....");

    const signer = await provider.getSigner(); //signing metams=ask screen open
    console.log(signer);
    //then metamask transaction screen opens to  send gas for minting
    //here we chain multiple functions
    const transaction = await nft
      .connect(signer, { gasLimit: 10000000 })
      .mint(tokenURI, { value: ethers.utils.parseUnits("1", "ether") });
    console.log(transaction);
    await transaction.wait();
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);
  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <div className="form">
        <form onSubmit={submitHandler}>
          <input
            type="text"
            placeholder="Create a name ...."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <input
            type="text"
            placeholder="Create a description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
          <input type="submit" value="Create & Mint" />
        </form>
        <div className="image">
          {!isWaiting && img ? (
            <img src={img} alt="AI Generated Image" />
          ) : isWaiting ? (
            <div className="image__placeholder">
              <Spinner animation="border" />
              <p>{message}</p>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>

      {!isWaiting && url && (
        <p>
          {" "}
          View &nbsp;{" "}
          <a href={url} target="_blank" rel="norefferer">
            Metadata
          </a>
        </p>
      )}
    </div>
  );
}

export default App;
