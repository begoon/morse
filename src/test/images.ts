// Question illustrations, keyed by the filename stored in the question banks'
// `image` field. The PNGs are inlined as data URIs by the png-dataurl plugin
// in build.ts, keeping the built page self-contained.

import rsgb1q11 from "../../foundation/rsgb.org/mock_01_q11.png";
import rsgb2q12 from "../../foundation/rsgb.org/mock_02_q12.png";
import rsgb2q14 from "../../foundation/rsgb.org/mock_02_q14.png";
import rsgb3q12 from "../../foundation/rsgb.org/mock_03_q12.png";
import ham1q15 from "../../foundation/hamtrain.co.uk/mock1-q15.png";
import ham2q10 from "../../foundation/hamtrain.co.uk/mock2-q10.png";
import ham2q14 from "../../foundation/hamtrain.co.uk/mock2-q14.png";
import ham3q7 from "../../foundation/hamtrain.co.uk/mock3-q7.png";
import ham4q12 from "../../foundation/hamtrain.co.uk/mock4-q12.png";
import ham5q11 from "../../foundation/hamtrain.co.uk/mock5-q11.png";
import ham6q7 from "../../foundation/hamtrain.co.uk/mock6-q7.png";
import ham7q9 from "../../foundation/hamtrain.co.uk/mock7/mock7-q9.png";
import ham7q10 from "../../foundation/hamtrain.co.uk/mock7/mock7-q10.png";
import ham7q11 from "../../foundation/hamtrain.co.uk/mock7/mock7-q11.png";
import ham7q15 from "../../foundation/hamtrain.co.uk/mock7/mock7-q15.png";
import extraq30 from "../../foundation/extra/q30.png";
import extraq31 from "../../foundation/extra/q31.png";
import extraq38 from "../../foundation/extra/q38.png";
import extraq45 from "../../foundation/extra/q45.png";
import extraq50 from "../../foundation/extra/q50.png";
import extraq55 from "../../foundation/extra/q55.png";

const IMAGES: Record<string, string> = {
    "mock_01_q11.png": rsgb1q11,
    "mock_02_q12.png": rsgb2q12,
    "mock_02_q14.png": rsgb2q14,
    "mock_03_q12.png": rsgb3q12,
    "mock1-q15.png": ham1q15,
    "mock2-q10.png": ham2q10,
    "mock2-q14.png": ham2q14,
    "mock3-q7.png": ham3q7,
    "mock4-q12.png": ham4q12,
    "mock5-q11.png": ham5q11,
    "mock6-q7.png": ham6q7,
    "mock7-q9.png": ham7q9,
    "mock7-q10.png": ham7q10,
    "mock7-q11.png": ham7q11,
    "mock7-q15.png": ham7q15,
    "q30.png": extraq30,
    "q31.png": extraq31,
    "q38.png": extraq38,
    "q45.png": extraq45,
    "q50.png": extraq50,
    "q55.png": extraq55,
};

export const imageFor = (file: string | undefined): string | undefined =>
    file === undefined ? undefined : IMAGES[file];
