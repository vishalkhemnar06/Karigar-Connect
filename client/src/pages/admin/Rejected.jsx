// src/components/admin/Rejected.jsx
import React, { useEffect } from 'react';
import PendingReview from './PendingReview';

const Rejected = (props) => {
    useEffect(() => {
        if (props.currentTab !== 'rejected') props.onTabChange('rejected');
    }, [props.currentTab, props.onTabChange]);

    return <PendingReview {...props} lockedTab="rejected" />;
};

export default Rejected;