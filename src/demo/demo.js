/**
 * Get the cryptographic hash of an ArrayBuffer
 *
 * @param ab - ArrayBuffer to digest
 * @param algorithm - Cryptographic hash digest algorithm
 * @returns Hexadecimal hash digest string
 */
async function hash(algorithm, ab) {
  const digest = new Uint8Array(
    await crypto.subtle.digest(algorithm, await ab),
  );
  return digest.reduce((memo, i) => memo + i.toString(16).padStart(2, '0'), '');
}

/**
 * Set and manage a timeout
 *
 * @param callback - Timeout callback
 * @param delay - Time in seconds to wait before calling the callback
 * @returns Timeout cancellation helper
 */
function timeout(callback, delay) {
  // eslint-disable-next-line no-restricted-globals
  const timer = self.setTimeout(callback, delay * 1000);
  // eslint-disable-next-line no-restricted-globals
  const clear = self.clearTimeout.bind(self, timer);
  return { clear };
}

// eslint-disable-next-line no-restricted-globals
const view = self;

const tests = [];
let failures = 0;

/** Penumbra has loaded */
const onReady = async ({ detail: { penumbra } } = { detail: view }) => {
  tests.push(
    [
      'penumbra.get() and penumbra.getTextOrURI() test',
      async () => {
        const cacheBuster = Math.random()
          .toString(10)
          .slice(2);
        await penumbra.setWorkerLocation({
          base: '/',
          decrypt: `decrypt.penumbra.worker.js?${cacheBuster}`,
          zip: `zip.penumbra.worker.js?${cacheBuster}`,
          StreamSaver: `streamsaver.penumbra.serviceworker.js?${cacheBuster}`,
        });
        const NYT = {
          url: 'https://s3-us-west-2.amazonaws.com/bencmbrook/NYT.txt.enc',
          filePrefix: 'NYT',
          mimetype: 'text/plain',
          decryptionOptions: {
            key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
            iv: '6lNU+2vxJw6SFgse',
            authTag: 'gadZhS1QozjEmfmHLblzbg==',
          },
        };
        const test1Text = await penumbra.getTextOrURI(await penumbra.get(NYT));
        // console.log(test1Text.type === 'text', `test1Text.type === 'text'`);
        const test1Hash = await hash(
          'SHA-256',
          new TextEncoder().encode(test1Text.data),
        );
        const ref1Hash =
          '4933a43366fdda7371f02bb2a7e21b38f23db88a474b9abf9e33309cd15594d5';
        const result = test1Text.type === 'text' && test1Hash === ref1Hash;
        // console.log(result, `test1Hash === ref1Hash`);
        return result;
      },
    ],
    [
      'progress event test',
      async () => {
        let result;
        const progressEventName = 'penumbra-progress-emit-test';
        const fail = () => {
          // console.log(false, 'progress event failed (took too long)');
          result = false;
        };
        const initTimeout = timeout(fail, 60);
        let stallTimeout;
        let initFinished = false;
        let progressStarted = false;
        let lastPercent;
        const onprogress = (event) => {
          const { percent } = event.detail;
          if (!Number.isNaN(percent)) {
            if (!initFinished) {
              initTimeout.clear();
              stallTimeout = timeout(fail, 10);
              initFinished = true;
              lastPercent = percent;
            } else if (!progressStarted) {
              if (percent > lastPercent) {
                stallTimeout.clear();
                progressStarted = true;
              }
            }
            if (progressStarted && percent > 25) {
              // eslint-disable-next-line no-restricted-globals
              view.removeEventListener(progressEventName, onprogress);
              result = true;
              // console.log(result, 'get() progress event test');
            }
          }
          lastPercent = percent;
        };
        view.addEventListener(progressEventName, onprogress);
        await new Response(
          await penumbra.get({
            url: 'https://s3-us-west-2.amazonaws.com/bencmbrook/k.webm.enc',
            filePrefix: 'k',
            mimetype: 'video/webm',
            decryptionOptions: {
              key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
              iv: '6lNU+2vxJw6SFgse',
              authTag: 'K3MVZrK2/6+n8/p/74mXkQ==',
            },
            progressEventName,
          }),
        ).arrayBuffer();
        return result;
      },
    ],
    [
      'penumbra.get() with multiple resources',
      async () => {
        const resources = await penumbra.get(
          {
            url: 'https://s3-us-west-2.amazonaws.com/bencmbrook/NYT.txt.enc',
            filePrefix: 'NYT',
            mimetype: 'text/plain',
            decryptionOptions: {
              key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
              iv: '6lNU+2vxJw6SFgse',
              authTag: 'gadZhS1QozjEmfmHLblzbg==',
            },
          },
          {
            url:
              'https://s3-us-west-2.amazonaws.com/bencmbrook/tortoise.jpg.enc',
            filePrefix: 'tortoise',
            mimetype: 'image/jpeg',
            decryptionOptions: {
              key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
              iv: '6lNU+2vxJw6SFgse',
              authTag: 'ELry8dZ3djg8BRB+7TyXZA==',
            },
          },
        );
        const hashes = await Promise.all(
          resources.map(async (rs) =>
            hash('SHA-256', await new Response(rs).arrayBuffer()),
          ),
        );
        const referenceHash1 =
          '4933a43366fdda7371f02bb2a7e21b38f23db88a474b9abf9e33309cd15594d5';
        const referenceHash2 =
          '1d9b02f0f26815e2e5c594ff2d15cb8a7f7b6a24b6d14355ffc2f13443ba6b95';
        const test1 = hashes[0] === referenceHash1;
        const test2 = hashes[1] === referenceHash2;
        // console.log(test1, `hashes[0] === referenceHash1`);
        // console.log(test2, `hashes[1] === referenceHash2`);
        return test1 && test2;
      },
    ],
    [
      'penumbra.get() images (as ReadableStream)',
      async () => {
        const content = await penumbra.get({
          url: 'https://s3-us-west-2.amazonaws.com/bencmbrook/tortoise.jpg.enc',
          filePrefix: 'tortoise',
          mimetype: 'image/jpeg',
          decryptionOptions: {
            key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
            iv: '6lNU+2vxJw6SFgse',
            authTag: 'ELry8dZ3djg8BRB+7TyXZA==',
          },
        });

        const imageBytes = await new Response(content).arrayBuffer();
        const imageHash = await hash('SHA-256', imageBytes);
        const referenceHash =
          '1d9b02f0f26815e2e5c594ff2d15cb8a7f7b6a24b6d14355ffc2f13443ba6b95';
        const result = imageHash === referenceHash;
        // console.log(result, `imageHash === referenceHash`);
        return result;
      },
    ],
    [
      'penumbra.getTextOrURI(): images (as URL)',
      async () => {
        const { type, data: url } = await penumbra.getTextOrURI(
          await penumbra.get({
            url:
              'https://s3-us-west-2.amazonaws.com/bencmbrook/tortoise.jpg.enc',
            filePrefix: 'tortoise',
            mimetype: 'image/jpeg',
            decryptionOptions: {
              key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
              iv: '6lNU+2vxJw6SFgse',
              authTag: 'ELry8dZ3djg8BRB+7TyXZA==',
            },
          }),
        );
        let isURL;
        try {
          // tslint:disable-next-line: no-unused-expression
          new URL(url, location.href); // eslint-disable-line no-new,no-restricted-globals
          isURL = type === 'uri';
        } catch (ex) {
          isURL = false;
        }
        // console.log(isURL, 'getTextOrURI(): valid URL', url);
        const imageBytes = await fetch(url).then((r) => r.arrayBuffer());
        const imageHash = await hash('SHA-256', imageBytes);
        const referenceHash =
          '1d9b02f0f26815e2e5c594ff2d15cb8a7f7b6a24b6d14355ffc2f13443ba6b95';
        const hashMatches = imageHash === referenceHash;
        // console.log(hashMatches, `imageHash === referenceHash`);
        return isURL && hashMatches;
      },
    ],
  );

  const getTestColor = (passed) => (passed ? 'limegreen' : 'crimson');

  // eslint-disable-next-line no-restricted-syntax
  for await (const [name, test] of tests) {
    const passed = await test();
    failures += !passed;
    console.log(
      `%c${passed ? '✅ PASS' : '❌ FAIL'} `,
      `◼️ font-size:larger;color:${getTestColor(passed)}`,
      `${name} ${passed ? 'passed' : 'failed'}`,
      `(returned ${JSON.stringify(passed)})`,
    );
  }
  console.log(
    `%c${failures ? `❌ ${failures} tests failed.` : '✅ All tests passed!'}`,
    `color:${getTestColor(!failures)}`,
  );
};

if (!view.penumbra) {
  view.addEventListener('penumbra-ready', onReady);
} else {
  onReady();
}
