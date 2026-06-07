// Question illustrations from the mock papers, keyed by "paper:question".
// The PNGs are inlined as data URIs by the png-dataurl plugin in build.ts,
// keeping the built page self-contained.

import mock01q11 from "../../foundation/hamtrain.co.uk/mock_01_q11.png";
import mock02q12 from "../../foundation/hamtrain.co.uk/mock_02_q12.png";
import mock02q14 from "../../foundation/hamtrain.co.uk/mock_02_q14.png";
import mock03q12 from "../../foundation/hamtrain.co.uk/mock_03_q12.png";

const IMAGES: Record<string, string> = {
    "1:11": mock01q11,
    "2:12": mock02q12,
    "2:14": mock02q14,
    "3:12": mock03q12,
};

export const imageFor = (paper: number, n: number): string | undefined =>
    IMAGES[`${paper}:${n}`];
