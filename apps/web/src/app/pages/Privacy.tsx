const CONTACT = import.meta.env.VITE_CONTACT_EMAIL;

/** What this site does with learners' data. Kept true to the code: change both together. */
export function Privacy() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Privacy</h1>
      <p>
        openpte has no adverts, no trackers and no third-party scripts or fonts. It never sells or
        shares your data.
      </p>
      <h2 className="text-lg font-semibold">Without an account</h2>
      <p>
        Your practice history stays in this browser on this device. Recordings stay on the device
        and are gone when you leave the page. The pronunciation check on this device downloads a
        model to your browser; your recording is not uploaded.
      </p>
      <h2 className="text-lg font-semibold">With an account</h2>
      <ul className="list-disc pl-6">
        <li>
          We keep your email address, your name if you give one, and your practice history, so you
          can use it on other devices. A cookie keeps you signed in; there are no other cookies.
        </li>
        <li>
          A speaking recording is uploaded only when you tick the box to send it. It is kept for 30
          days, or until you delete it, and only you can play it unless you send it to your teacher.
        </li>
        <li>
          Writing answers are checked for grammar by this site’s own grammar server, which does not
          keep them.
        </li>
        <li>
          If you join an institute, its teachers see how many questions you answer and your marks by
          skill. They see an answer or recording only when you send it to them.
        </li>
        <li>
          If you sign in with Google, Google tells us your email address and name, and knows that
          you signed in here.
        </li>
        <li>
          The server’s logs record network addresses and errors so the service can be kept running
          and protected from abuse.
        </li>
      </ul>
      <h2 className="text-lg font-semibold">Your choices</h2>
      <p>
        Under More you can delete your practice history from your account and this device, and
        delete saved recordings. To have your account and everything in it deleted, or for any
        question about your data,{' '}
        {CONTACT ? (
          <>
            email{' '}
            <a className="underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </>
        ) : (
          'contact the people who run this site.'
        )}
      </p>
      <p className="text-sm text-muted">
        openpte is open-source software; anyone can check what it does with data in its code.
      </p>
    </div>
  );
}
