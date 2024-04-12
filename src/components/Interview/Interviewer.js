import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import fetch from "../../helper/question";
import ReactPlayer from "react-player";
import peer from "../../service/peer";
import { useSocket } from "../../context/SocketProvider";
import { motion } from "framer-motion";

const Interviewer = (props) => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const { postID, typeID, InterviewID, roomID } = useParams();
  const [qid, setQid] = useState(0);
  const [questions, setQuestions] = useState([]);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);
  useEffect(()=>{
    socket.emit("room:join", { email:InterviewID, room:roomID,type:"interview"});
  },[postID,typeID,InterviewID,roomID]);
  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    console.log(stream.getVideoTracks());
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  const speak = (text) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  };

  useEffect(() => {
    const getQ = async () => {
      try {
        const ques = await fetch(postID);

        setQuestions(ques);
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };

    if (questions.length === 0) {
      getQ();
    }
  }, [questions]); // Run effect when questions state changes

  const start = Date.now();

  const calculateTimeLeft = () => {
    let difference = Date.now() - start;
    return props.QuestionTimer - difference / 1000;
  };
  const [sec, setSec] = useState();

  //todo Remove the header from the meet
  const RemoveHeader = document.getElementById("layout-header");
  if (RemoveHeader) {
    console.log("Header Removed");
    RemoveHeader.style.display = "none";
  }

  //todo Toggle Exit options from where
  const [exitOption, setExitOption] = useState(false);
  const Confirmation = document.getElementById("exits-options");

  const toggleExitOption = () => {
    setExitOption(!exitOption);
    if (Confirmation)
      Confirmation.style.display = exitOption === true ? "flex" : "none";
  };

  const backToHome = () => {
    RemoveHeader.style.display = "flex";
    console.log("Back to Home");
  };

  const startInterview = () => {
    let idx = 0;
    speak(questions[idx]);
    setInterval(() => {
      if (idx == questions.length - 1) {
        clearInterval();
      }
      speak(questions[++idx]);
      setQid((qid) => qid + 1);
    }, 300 * 1000); // time for question + answer
  };

  return (
    <>
      <div className="w-full h-16 flex bg-slate-600 ">
        <button
          onClick={toggleExitOption}
          className="text-white text-lg absolute top-3 left-3 z-10"
        >
          <img src="" alt="Exit" />
        </button>
      </div>
      {remoteSocketId && (
        <button onClick={handleCallUser} className=" text-red-400">
          CALL
        </button>
      )}
      <div className="w-full h-screen bg-slate-950 m-0 p-0 z-9 flex items-center">
        {/* EXIT */}

        {remoteSocketId ? (
          <p className="text-[rgb(0,255,0)] text-lg font-semibold absolute bottom-10 left-4">
            Connected
          </p>
        ) : (
          <p className="text-[rgb(255,0,0)] text-lg font-semibold absolute bottom-10 left-4">
            No one in the room
          </p>
        )}

        <img
          src="/Logo.png"
          alt="LOGO"
          width="150px"
          className="absolute top-[15%] right-20"
        />

        {/* {myStream && <button onClick={sendStreams} className="text-white">Send Stream</button>}
        {remoteSocketId && <button onClick={handleCallUser} className="text-white">CALL</button>}  */}
        {/* Main meet */}
        <div className="main-meet flex w-11/12 h-4/5 m-auto items-center px-auto justify-around">
          {/* <div className="w-3/5 h-3/4 rounded-lg bg-slate-500"> */}
          {/* <div className="rounded-lg bg-slate-100 flex"> */}
          <div className="w-1/2 h-1/2 min-w-[640px] min-h-[480px] rounded-lg bg-slate-500 hover:shadow-[55px_-43px_120px_rgba(112,0,255,0.25),-74px_39px_120px_rgba(204,0,255,0.25)]">
            {/* , -74px_39px_120px_rgba(204,0,255,0.25) */}
            {remoteStream && (
              <>
                <ReactPlayer
                  playing
                  muted
                  height="100%"
                  width="100%"
                  // className="w-3/5 h-3/4 rounded-lg bg-slate-500"
                  url={remoteStream}
                />
              </>
            )}
          </div>
          <div className="w-1/3 h-1/2 bg-[rgba(36,29,66,0.39)] hover:shadow-[55px_-43px_120px_rgba(112,0,255,0.25),-74px_39px_120px_rgba(204,0,255,0.25)] rounded-md ">
            <div className="w-full flex justify-between">
              <button
                onClick={startInterview}
                className="w-[calc(50%-0.5px)] h-8  text-white rounded-tl-md border-b "
              >
                start
              </button>
              <button
                className="w-[calc(50%-0.5px)] h-8 text-white rounded-tr-md border-b"
                onClick={() => speak(questions[qid])}
              >
                Saale
              </button>
            </div>
            <div className="w-full h-[calc(100%-35px)] flex flex-col items-center justify-between px-2 ">
              {questions.map((question, index) => (
                <div
                  key={index}
                  className="bg-[#4646464b] text-white h-fit rounded-sm p-2"
                >
                  {question}
                </div>
              ))}
            </div>
          </div>
          {/* </div> */}
        </div>

        {/* //* need nhi h same chij ko hum log Absolute kar ke dikha denge*/}
        {/* <div
            id="RIGHT-SIDE-OPTIONS"
            className="h-full flex-col items-center justify-center border-white border-2"
          > */}
        {/* <div className="logo-meet absolute top-10 right-14 h-14 w-14 bg-slate-50">
              <img src="" alt="LOGO" />{" "}
            </div> */}

        {/* //todo time and command component */}
        {/* <div className="w-60 h-1/4 bg-slate-600 rounded-2xl items-center">
              <div className="w-full h-[70%] bg-red-400 rounded-t-2xl  ">
                {props.QuestionTimer}
              </div>
              <div className="flex w-full h-[30%] justify-around rounded-b-2xl">
                <button className="h-full w-[49%] bg-slate-400 rounded-bl-2xl ">
                  Ask
                </button>
                <button className="rounded-br-2xl h-full w-[49%] bg-slate-400">
                  Next
                </button>
              </div>
            </div> */}

        {/* //! OUR_CAMERA */}
        <motion.div
          className="h-40 w-60 border-2 border-green-400 absolute bottom-5 right-3"
          whileHover={{ scale: 1.1 }}
          // whileTap={{ scale: 0.9 }}
        >
          {/* <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} /> */}
          {myStream && (
            <ReactPlayer
              playing
              muted
              height="100%"
              width="100%"
              url={myStream}
            />
          )}
        </motion.div>
      </div>
      {/* </div> */}
      {/* </div> */}

      <div
        id="exits-options"
        className="w-full h-full backdrop-blur-lg absolute top-0 bg-[rgba(23, 23, 23, 0.44)] items-center justify-center hidden"
      >
        <button
          onClick={toggleExitOption}
          className="text-white text-lg absolute top-3 left-3"
        >
          <img src="" alt="Exit" />
        </button>
        {/* //todo exit confirmation */}
        <div className="w-[300px] h-28 flex flex-col items-center justify-around">
          <div className="w-[299px] h-[77px] bg-slate-400 rounded-t-2xl p-2 text-center ">
            Do you want to quit the interview
          </div>
          <div className="flex w-full h-[33px] justify-around rounded-b-2xl">
            <button
              className="h-full w-[149px] bg-slate-400 rounded-bl-2xl "
              onClick={toggleExitOption}
            >
              No
            </button>
            <button
              className="rounded-br-2xl h-full w-[149px] bg-slate-400"
              onClick={backToHome}
            >
              <Link to="/">Yes</Link>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default Interviewer;

Interviewer.defaultProps = {
  QuestionTimer: 100,
};