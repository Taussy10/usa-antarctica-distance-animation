import "./index.css";
import { Composition } from "remotion";
import { UsaAntarticaComp } from "./comp-1/UsaAntarticaComp";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="usa-antartica"
        component={UsaAntarticaComp}
        durationInFrames={850}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
